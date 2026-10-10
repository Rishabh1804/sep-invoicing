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
var _kbScreen = '';          // what the page last showed (a view, an article on the phone, the form): another is a navigation
var _kbListing = false;      // while Knowledge draws its own lists: the open article's row is marked there only
var _kbOpen = null;          // the article open: the desktop's pane, the phone's own screen
var _kbEdit = null;          // the form: {id, kind, title, summary, body, tags, readers, links, f: {kind's fields}, images, uid, v0, s0}
var _kbFilter = { q: '', kind: '', status: '', link: null };   // link: {type, id, label}: the guides for one screen, the articles on one record

if (typeof STATE_CONTAINERS !== 'undefined' && STATE_CONTAINERS.indexOf('kb') < 0) STATE_CONTAINERS.push('kb');

/* ---------- The store ---------- */
/* deleted: [{id, at, by}], a draft deleted here, so an import of an older file does not bring it back. */
function kbData() {
  if (!S.kb || typeof S.kb !== 'object' || Array.isArray(S.kb)) S.kb = {};
  ['articles', 'trained', 'paths', 'deleted'].forEach(function(k) { if (!Array.isArray(S.kb[k])) S.kb[k] = []; });
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
/* Read: a draft or a pending article by its author and the owner; anything else by the roles it names. Stored as
   `roles`: [] is everyone, ['owner'] the owner alone, else the owner and the roles named (the QA chain of 5 Oct 2026: none
   ticked had been stored as [], everyone). */
function kbCanRead(a) {
  if (!a) return false;
  if (a.status === 'draft' || a.status === 'pending') return kbIsOwner() || kbMine(a);
  if (!kbGuardOn() || kbIsOwner()) return true;
  var u = grdUser();
  if (!u) return false;
  return !a.roles || !a.roles.length || a.roles.indexOf(u.role) >= 0;
}
function kbReadable() { return kbAll().filter(kbCanRead); }
function kbLive(a) { return a && (a.status === 'published' || a.src === 'build'); }
function kbGuardOn() { return typeof grdOn === 'function' && grdOn(); }
/* The form's ticks from what is stored, and back. */
function kbReadersOf(roles) {
  if (!Array.isArray(roles) || !roles.length) return KB_READ_ROLES.slice();
  return KB_READ_ROLES.filter(function(r) { return roles.indexOf(r) >= 0; });
}
function kbRolesFrom(readers) {
  var r = KB_READ_ROLES.filter(function(x) { return (readers || []).indexOf(x) >= 0; });
  return r.length === KB_READ_ROLES.length ? [] : r.length ? r : ['owner'];
}
/* A screen the role opens, and the roster's names (People or Floor): what an article draws from the book follows them. */
function kbSeesPage(p) { return typeof grdSees !== 'function' || grdSees(p); }
function kbSeesRoster() { return !kbGuardOn() || kbSeesPage('pageStaff') || kbSeesPage('pageFloor'); }
/* Training is a floor entry made against the roster. */
function kbTrainOk() { return (typeof grdCan !== 'function' || grdCan('floor')) && kbSeesRoster(); }
/* Edit: the owner, or the writer of a draft; a published article by anyone, as a proposal unless it is the owner's edit. A
   ruling once published, a retired or replaced article and the app's own guides are never edited; while one person's
   proposed change waits, nobody else proposes another (it replaced the first unseen). */
function kbCanEdit(a) {
  if (!a || a.src === 'build' || !kbCanWrite() || !kbCanRead(a)) return false;
  if (a.status === 'retired' || a.status === 'superseded') return false;
  if (a.status === 'draft' || a.status === 'pending') return kbIsOwner() || kbMine(a);
  if (a.kind === 'ruling') return false;
  return kbIsOwner() || !a.pending || a.pending.byId === kbMe().id;
}
/* A published ruling is replaced by a new one, by anyone who writes (it waits for the owner like any article). */
function kbCanReplace(a) { return !!a && a.src !== 'build' && a.kind === 'ruling' && a.status === 'published' && kbCanWrite() && kbCanRead(a); }
/* A draft never published goes for good: the owner's, or its writer's. */
function kbCanDelete(a) { return !!a && a.src !== 'build' && (a.status === 'draft' || a.status === 'pending') && !(a.versions || []).length && (kbIsOwner() || kbMine(a)); }
/* The proposed change on an article: the owner's to judge, its writer's to see. */
function kbSeesProposal(a) { return !!(a && a.pending) && (kbIsOwner() || (a.pending.byId != null && a.pending.byId === kbMe().id)); }

/* ---------- The text ---------- */
/* The shop's own text, drawn as text: paragraphs, "- " lists, "1. " numbered lists, "# " heads and **bold**, every
   character through escHtml. A numbered list had run into one paragraph (the app's own guides are written in them). */
function kbBodyHtml(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n'), out = '', para = [], list = [], tag = '', start = 1;
  var inline = function(s) { return escHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); };
  var flushPara = function() { if (para.length) { out += '<p>' + para.map(inline).join(' ') + '</p>'; para = []; } };
  var flushList = function() {
    if (!list.length) return;
    out += '<' + tag + (tag === 'ol' && start !== 1 ? ' start="' + start + '"' : '') + '>' + list.map(function(x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + tag + '>';
    list = [];
  };
  lines.forEach(function(l) {
    var t = l.trim();
    if (!t) { flushPara(); flushList(); return; }
    var h = /^#{1,3}\s+(.*)$/.exec(t), ul = /^[-*•]\s+(.*)$/.exec(t), ol = /^(\d{1,3})[.)]\s+(.*)$/.exec(t);
    if (h) { flushPara(); flushList(); out += '<h3 class="inv-kb-h">' + inline(h[1]) + '</h3>'; return; }
    if (ul || ol) {
      flushPara();
      var tg = ol ? 'ol' : 'ul';
      if (list.length && tag !== tg) flushList();
      if (!list.length) { tag = tg; start = ol ? +ol[1] : 1; }
      list.push(ol ? ol[2] : ul[1]);
      return;
    }
    flushList();
    para.push(t);
  });
  flushPara();
  flushList();
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
function kbRolesText(a) {
  if (!a.roles || !a.roles.length) return 'Everyone';
  var r = a.roles.filter(function(x) { return x !== 'owner'; });
  return r.length ? ['Owner'].concat(r.map(grdRoleName)).join(', ') : 'The owner only';
}

/* ---------- Links ---------- */
function kbLinkName(l) {
  var lbl = l.label || '';
  try {
    if (l.type === 'client') { var c = (S.clients || []).find(function(x) { return String(x.id) === String(l.id); }); if (c) return c.name; }
    // An area by its id; one written by name only (an import) reads as written, never as a dash.
    if (l.type === 'area') { var ar = l.id && typeof STAFF_AREAS !== 'undefined' && STAFF_AREAS.find(function(x) { return x.id === l.id; }); if (ar) return ar.label; }
    if (l.type === 'line') { var ln = KB_LINES.find(function(x) { return x[0] === l.id; }); if (ln) return ln[1]; }
    if (l.type === 'stock') { var it = stockItem(l.id); if (it) return it.name; }
    if (l.type === 'screen') return wsPageName(l.id) || lbl;
    if (l.type === 'worker') { var w = staffById(l.id); if (w) return w.name; }
    // An article this role does not read is not named (its title is its content).
    if (l.type === 'article') { var a = kbFind(l.id); if (a) return kbCanRead(a) ? a.title : 'An article you do not read'; }
  } catch (e) { /* the label as written */ }
  return lbl || l.id || '';
}
/* The articles linked to a record. A link names a record by id, or by the name as written (a part, or a record this book
   does not hold): either matches, the name in its letters and digits alone ("SSS MEHTA" is SSSMEHTA). */
function kbNameKey(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function kbLinkedTo(type, id, label) {
  var key = String(id == null ? '' : id), nm = kbNameKey(label);
  return kbReadable().filter(function(a) {
    if (a.status === 'retired' || a.status === 'superseded') return false;
    return (Array.isArray(a.links) ? a.links : []).some(function(l) {
      if (!l || l.type !== type) return false;
      if (key && String(l.id) === key) return true;
      return !!nm && kbNameKey(l.label) === nm;
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
  // The article open beside the list is marked as the current row (aria-current, as the Register's), in Knowledge's own
  // lists only: a client's panel is not that list.
  return '<div class="inv-row' + (a.status === 'retired' || a.status === 'superseded' ? ' inv-row-muted' : '') + '" data-kb-row="' + escHtml(a.id) + '"' + (_kbListing && _isDesktop && _kbOpen === a.id ? ' aria-current="true"' : '') + '>' +
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
    return '<figure class="inv-kb-fig"><img class="inv-kb-img" data-kb-img="' + escHtml(im.id) + '" alt="' + escHtml(im.caption || 'Photo') + '" width="' + (Math.max(0, parseInt(im.w, 10)) || 0) + '" height="' + (Math.max(0, parseInt(im.h, 10)) || 0) + '">' +
      (im.caption ? '<figcaption class="inv-note">' + escHtml(im.caption) + '</figcaption>' : '') + '</figure>';
  }).join('');
}

/* ---------- Training ---------- */
/* A lesson is a how-to, a process or a fault that is live: a fault (what you see, its causes, the check and the fix) is
   taught like any lesson (the first content's paths name 12 of them). */
function kbIsLesson(a) { return kbLive(a) && (a.kind === 'guide' || a.kind === 'process' || a.kind === 'fault'); }
function kbVer(a) { var v = parseInt(a && a.version, 10); return v > 0 ? v : 1; }
/* The version an article was at on a day: training recorded for an earlier day was given on the text of that day, so a
   version published since makes it due again. */
function kbVerOn(a, iso) {
  if (!iso || iso >= localDateStr()) return kbVer(a);
  var best = 0, first = kbVer(a);
  (a.versions || []).concat([{ v: kbVer(a), at: a.approvedAt || a.at }]).forEach(function(x) {
    var v = parseInt(x && x.v, 10) || 0;
    if (v > 0 && v < first) first = v;
    if (v > best && x.at && isoOf(new Date(x.at)) <= iso) best = v;
  });
  return best || first;
}
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
/* The paths: the book's own, then the app's for a role the book has none for (each role saw two of the same name). */
function kbPaths() {
  var own = kbData().paths.filter(function(p) { return p && Array.isArray(p.articles); }), has = {};
  own.forEach(function(p) { if (p.role) has[p.role] = true; });
  return own.concat((typeof KB_APP_PATHS !== 'undefined' ? KB_APP_PATHS : []).filter(function(p) { return !has[p.role]; }));
}
/* Who a path is for on the roster: the floor's the floor hands, the office's the hands off the floor, else everyone. */
function kbPathWho(p, roster) {
  return roster.filter(function(w) { return p.role === 'floor' ? w.onFloor !== false : p.role === 'office' ? w.onFloor === false : true; });
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
  cuts: { label: 'Power cuts, last 90 days', page: 'pagePower', fn: function() { var r = _kbRange(90), n = powerCuts(r.from, r.to).length; return { v: n, text: String(n) }; } }
};
/* A figure the role may read: money needs the finance permission, a client's figure the Clients screen, power cuts Power. */
function kbFigureSees(key) {
  var f = KB_FIGURES[key];
  return !!f && (!f.money || typeof grdSeesMoney !== 'function' || grdSeesMoney()) && (!f.client || kbSeesPage('pageClients')) && (!f.page || kbSeesPage(f.page));
}
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
/* The view an article opens on: the list of its kind, with the desktop's pane beside it (Start and Training have none). */
function kbTabFor(kind) { return kind === 'fault' || kind === 'incident' ? 'troubleshoot' : kind === 'ruling' || kind === 'decision' ? 'records' : 'library'; }
function kbHasPane(t) { return /^(library|troubleshoot|records)$/.test(t); }
/* The form is the person's who opened it: the next to sign in is never handed it (the QA chain of 5 Oct 2026: a
   supervisor's half-typed article was published by the owner who unlocked next, unapproved). */
function kbFormOk(e) { return !!e && e.uid === kbMe().id; }
/* Every move inside Knowledge is a step of the trail. The place is the address; what the address does not carry (a
   filter, a form made with its kind) is set by `prep` once the place being left is read. Moves had changed the state and
   then opened the place, found themselves there already and wrote over the step they came from: Back from Records went to
   Stats, and Back from the form skipped the article (the QA chain of 5 Oct 2026). */
function kbGo(loc, prep) {
  var before = typeof navLoc === 'function' ? navLoc() : null;
  if (prep) prep();
  if (typeof navPush === 'function' && _navBooted && navKey(loc) !== navKey(before)) navPush(loc);
  navApply(loc);
}
function kbNavApply(v, id) {
  var parts = String(v || '').split('/'), a = id ? kbFind(id) : null, readable = !!a && kbCanRead(a);
  // An article named on a view with no pane (an older address) opens on its own list's view.
  if (readable && parts[1] !== 'edit' && !kbHasPane(parts[0])) parts[0] = kbTabFor(a.kind);
  kbSetTab(parts[0]);
  if (parts[1] === 'edit') {
    if (_kbEdit && (!kbFormOk(_kbEdit) || String(_kbEdit.id || '') !== String(id || ''))) _kbEdit = null;
    if (!_kbEdit) {
      // Only a form its person may open: the address is no door around who reads or edits what (an article this role
      // does not read opened as "Propose a change" with its text; a published ruling was edited into a version 2).
      var own = id ? kbOwnFind(id) : null;
      if (own ? kbCanEdit(own) : !id && kbCanWrite()) _kbEdit = own ? kbFormFrom(own) : kbBlankForm('guide');
    }
    _kbOpen = _kbEdit ? null : readable ? a.id : null;
  } else {
    _kbEdit = null;
    _kbOpen = readable ? a.id : null;
  }
}
function kbNavLabel(v, id) {
  var parts = String(v || '').split('/'), t = KB_TABS.find(function(x) { return x[0] === parts[0]; }), a = id && kbFind(id);
  return { sub: [t ? t[1] : 'Start', parts[1] === 'edit' ? (a ? 'Edit' : 'New article') : ''], rec: a && kbCanRead(a) ? a.title : '' };
}
function kbSetTab(t) {
  if (!KB_TABS.some(function(x) { return x[0] === t; })) t = 'start';
  _kbTab = t;
  try { localStorage.setItem(KB_TAB_KEY, t); } catch (e) { /* a per-device convenience only */ }
}
/* Leaving the page leaves the form (tabs.js switchTab): its own step reopens it as a form on the article, never with what
   was typed. Leave, then a tap on Knowledge itself, had shown the form again with nothing to say it was typed. */
function kbLeave() { _kbEdit = null; }
function kbBackBar(title, action) {
  return '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="' + (action || 'invKbBack') + '">' + STOCK_BACK_ICON + 'Knowledge</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(title) + '</h2></div>';
}
function renderKnow() {
  var el = document.getElementById('knowContent');
  if (!el || !S) return;
  kbData();
  if (_kbEdit && !kbFormOk(_kbEdit)) { _kbEdit = null; _pageTyped = false; }
  var open = _kbOpen ? kbFind(_kbOpen) : null;
  if (open && !kbCanRead(open)) { open = null; _kbOpen = null; }
  var h, screen;
  if (_kbEdit) { h = kbFormHtml(); screen = 'form:' + (_kbEdit.id || 'new'); }
  else if (open && !_isDesktop) { h = kbBackBar(open.title || 'Article') + kbArticleHtml(open); screen = 'article:' + open.id; }
  else {
    screen = 'view:' + _kbTab;
    var pane = _isDesktop && kbHasPane(_kbTab), v;
    _kbListing = true;
    try {
      v = _kbTab === 'library' ? kbLibraryHtml() : _kbTab === 'troubleshoot' ? kbTroubleHtml() : _kbTab === 'records' ? kbRecordsHtml()
        : { head: '', body: _kbTab === 'training' ? kbTrainingHtml() : kbStartHtml() };
    } finally { _kbListing = false; }
    // One primary between the list and the article beside it (DR-3): the article's own, where it has one.
    var paneActs = pane && open ? kbActionList(open) : [];
    h = '<div class="inv-viewtabs" role="tablist" aria-label="Knowledge">' + KB_TABS.map(function(t) {
      return '<button class="inv-viewtab" role="tab" aria-selected="' + (_kbTab === t[0]) + '" data-action="invKbTab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' + kbToolbarHtml(paneActs.some(function(x) { return x[2] === 'primary'; }));
    // On the desktop the search and the chips stay above the list as it scrolls (History's toolbar), the article beside it.
    if (pane) h += v.head + '<div class="inv-pane-host' + (open ? ' inv-pane-open' : '') + '" id="kbHost" data-open="' + (open ? escHtml(open.id) : '') + '"><div class="inv-pane-list">' + v.body + '</div>' +
      '<div class="inv-pane" id="kbPane">' + (open ? paneHeadHtml('<span class="inv-panel-title">' + escHtml(open.title || 'Article') + '</span>', 'invKbClose') + kbArticleHtml(open) : '') + '</div></div>';
    else h += v.head + v.body;
  }
  paneScrollKeep(function() { el.innerHTML = h; });
  viewTabReveal(el.querySelector('.inv-viewtabs'));
  kbFillImages(el);
  // Another view, an article opened on the phone or the form is a navigation and starts at the top (they opened where the
  // list had been scrolled, the article's title off the screen). A redraw of the same screen keeps its place.
  if (screen !== _kbScreen) { var was = _kbScreen; _kbScreen = screen; if (was) viewTop(); }
}
function kbToolbarHtml(demote) {
  var w = kbCanWrite(), prim = demote ? '' : _kbTab === 'troubleshoot' ? 'incident' : _kbTab === 'training' ? 'train' : 'write';
  var b = function(kind, label, act, extra) { return '<button class="inv-btn inv-btn-' + (kind === prim ? 'primary' : 'secondary') + '" data-action="' + act + '"' + (extra || '') + '>' + label + '</button>'; };
  var h = '<div class="inv-toolbar">';
  if (w) {
    h += b('write', 'Write', 'invKbNew', _kbTab === 'troubleshoot' ? ' data-kind="fault"' : _kbTab === 'records' ? ' data-kind="ruling"' : '');
    if (_kbTab === 'troubleshoot') h += b('incident', 'Log an incident', 'invKbNew', ' data-kind="incident"');
    if (_kbTab === 'training' && kbTrainOk()) h += b('train', 'Record training', 'invKbTrain');
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
  var again = kbSeesRoster() ? kbDueAgain().filter(function(x) { return kbCanRead(x.a); }) : [];
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
/* Each list view: its head (search, chips) and its body, apart, so the desktop keeps the head above the scrolling list. */
function kbLibraryHtml() {
  var list = kbFiltered(kbReadable()), head = kbSearchHtml('Search articles') + kbChipsHtml(KB_KINDS.map(function(k) { return k[0]; }));
  if (_kbFilter.link) head += '<div class="inv-callout inv-callout-info" id="kbLinkFilter">' + escHtml('Linked to ' + kbLinkName(_kbFilter.link)) + ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbLinkClear">Show all</button></div>';
  var h = '<div class="inv-panel inv-panel-flush" id="kbLibrary"><div class="inv-panel-head"><span class="inv-panel-title">Articles <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) h += '<div class="inv-empty">' + (kbReadable().length ? 'Nothing matches.' : 'Nothing here yet.') + '</div>';
  var rows = [];
  KB_KINDS.forEach(function(k) {
    var of = list.filter(function(a) { return a.kind === k[0]; }).sort(function(x, y) { return String(x.title).localeCompare(String(y.title)); });
    if (!of.length) return;
    rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(k[2]) + '</span><span>' + of.length + '</span></div>'] });
    of.forEach(function(a) { rows.push(kbRowHtml(a)); });
  });
  return { head: head, body: h + uiMoreHtml('kb-lib', rows, { n: 60, noun: 'articles' }) + '</div>' };
}
/* Troubleshoot: faults by symptom, each with its incidents; then the latest incidents. */
function kbTroubleHtml() {
  var all = kbReadable(), faults = kbFiltered(all.filter(function(a) { return a.kind === 'fault'; })), head = kbSearchHtml('What do you see? Dull, peeling, white rust…');
  var h = '<div class="inv-panel inv-panel-flush" id="kbFaults"><div class="inv-panel-head"><span class="inv-panel-title">Faults <span class="inv-panel-count">' + faults.length + '</span></span></div>' +
    (faults.length ? faults.sort(function(x, y) { return String(x.symptom || x.title).localeCompare(String(y.symptom || y.title)); }).map(function(a) {
      var n = all.filter(function(i) { return i.kind === 'incident' && i.faultId === a.id && i.status !== 'retired'; }).length;
      return '<div class="inv-row" data-kb-row="' + escHtml(a.id) + '"' + (_isDesktop && _kbOpen === a.id ? ' aria-current="true"' : '') + '><button class="inv-row-main" data-action="invKbOpen" data-id="' + escHtml(a.id) + '"><span class="inv-row-title">' + escHtml(a.symptom || a.title) + '</span>' +
        '<span class="inv-row-meta">' + escHtml([a.symptom ? a.title : '', todoPlural((a.causes || []).length, 'cause'), n ? todoPlural(n, 'incident') : ''].filter(Boolean).join(' · ')) + '</span></button>' +
        '<span class="inv-row-end">' + (a.status === 'published' ? '' : kbStatusHtml(a)) + '</span></div>';
    }).join('') : '<div class="inv-empty">No fault written yet' + (_kbFilter.q ? ' for that' : '') + '.</div>') + '</div>';
  var inc = all.filter(function(a) { return a.kind === 'incident' && a.status !== 'retired'; }).sort(function(x, y) { return String(kbDayOf(y)).localeCompare(String(kbDayOf(x))); });
  h += '<div class="inv-panel inv-panel-flush" id="kbIncidents"><div class="inv-panel-head"><span class="inv-panel-title">Incidents <span class="inv-panel-count">' + inc.length + '</span></span></div>' +
    (inc.length ? uiMoreHtml('kb-inc', inc.map(function(a) { return kbRowHtml(a); }), { noun: 'incidents' }) : '<div class="inv-empty">No incident logged yet. Log one when something goes wrong: what, when, which part, the cause and the fix.</div>') + '</div>';
  return { head: head, body: h };
}
/* Records: rulings, incidents and decisions by the day they are about. */
function kbRecordsHtml() {
  var kinds = ['ruling', 'requirement', 'incident', 'decision'];
  var list = kbFiltered(kbReadable().filter(function(a) { return kinds.indexOf(a.kind) >= 0; })).sort(function(x, y) { return String(kbDayOf(y)).localeCompare(String(kbDayOf(x))); });
  var head = kbSearchHtml('Search the records') + kbChipsHtml(kinds);
  var h = '<div class="inv-panel inv-panel-flush" id="kbRecords"><div class="inv-panel-head"><span class="inv-panel-title">Records <span class="inv-panel-count">' + list.length + '</span></span></div>';
  if (!list.length) h += '<div class="inv-empty">No record yet.</div>';
  var rows = [], last = '';
  list.forEach(function(a) {
    var m = String(kbDayOf(a)).slice(0, 7);
    if (m !== last) { last = m; rows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + escHtml(m ? billsMonthLabel(m) : 'Undated') + '</span></div>'] }); }
    rows.push(kbRowHtml(a));
  });
  return { head: head, body: h + uiMoreHtml('kb-rec', rows, { n: 40, noun: 'records' }) + '</div>' };
}
/* Training: each path, and the roster against it. The roster's names (and who was trained on what) only for a role that
   opens People or Floor: Knowledge is every role's page, the roster is not. */
function kbTrainingHtml() {
  var paths = kbPaths(), sees = kbSeesRoster(), roster = sees ? staffActive() : [], h = '';
  if (!paths.length) h += '<div class="inv-empty">No training path yet.</div>';
  paths.forEach(function(p) {
    var arts = kbPathArticles(p), who = kbPathWho(p, roster);
    // A path shows its first five lessons, the rest one tap away (the length pass's rule): the paths grew with the entry
    // faces' guides (F6), and Training ran past its budget (P195).
    var rows = arts.map(function(a, i) {
      var done = 0, due = 0;
      who.forEach(function(w) { var st = kbTrainState(w.id, a).state; if (st === 'yes') done++; else if (st === 'due') due++; });
      return '<div class="inv-row"><button class="inv-row-main" data-action="invKbOpen" data-id="' + escHtml(a.id) + '"><span class="inv-row-title">' + (i + 1) + '. ' + escHtml(a.title) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(kbKindName(a.kind) + ' · v' + kbVer(a) + (who.length ? ' · trained ' + done + ' of ' + who.length : '')) + '</span></button>' +
        '<span class="inv-row-end">' + (due ? '<span class="inv-dot inv-dot-warning">' + due + ' due again</span>' : '') + '</span></div>';
    });
    h += '<div class="inv-panel inv-panel-flush" data-kb-path="' + escHtml(p.id) + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(p.title) + ' <span class="inv-panel-count">' + arts.length + '</span></span></div>' +
      (rows.length ? uiMoreHtml('kb-path-' + p.id, rows, { n: rows.length === 6 ? 6 : 5, noun: 'lessons' }) : '<div class="inv-empty">None of this path&rsquo;s lessons is published yet.</div>') + '</div>';
  });
  if (!sees) return h + '<div class="inv-note">Who was trained is kept against the roster, which People and Floor show.</div>';
  // The roster against every lesson given.
  var lessons = kbReadable().filter(kbIsLesson);
  h += '<div class="inv-panel inv-panel-flush" id="kbRoster"><div class="inv-panel-head"><span class="inv-panel-title">The roster <span class="inv-panel-count">' + roster.length + '</span></span></div>';
  if (!roster.length) h += '<div class="inv-empty">Nobody on the roster yet.</div>';
  var rec = kbTrainOk();
  h += uiMoreHtml('kb-roster', roster.map(function(w) {
    var yes = 0, due = 0;
    lessons.forEach(function(a) { var st = kbTrainState(w.id, a).state; if (st === 'yes') yes++; else if (st === 'due') due++; });
    var meta = '<span class="inv-row-title">' + escHtml(w.name) + '</span><span class="inv-row-meta">' + escHtml(areaLabel(w.homeArea || w.area || '') + ' · trained on ' + yes + ' of ' + lessons.length) + '</span>';
    return '<div class="inv-row">' + (rec ? '<button class="inv-row-main" data-action="invKbTrain" data-staff="' + escHtml(String(w.id)) + '">' + meta + '</button>' : '<span class="inv-row-main">' + meta + '</span>') +
      '<span class="inv-row-end">' + (due ? '<span class="inv-dot inv-dot-warning">' + due + ' due again</span>' : lessons.length && yes === lessons.length ? '<span class="inv-dot inv-dot-ok">All trained</span>' : '') + '</span></div>';
  }), { noun: 'hands' }) + '</div>';
  // What was given, on lessons this role reads.
  var log = kbData().trained.filter(function(t) { var a = kbFind(t.articleId); return !t.voidedAt && (!a || kbCanRead(a)); }).sort(function(x, y) { return y.at - x.at; });
  if (log.length) h += uiFoldHtml('kb-trainlog', '<span class="inv-panel-title">Training given <span class="inv-panel-count">' + log.length + '</span></span>', uiMoreHtml('kb-trainlog', log.map(function(t) {
    var a = kbFind(t.articleId);
    return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml((t.name || '') + ' · ' + (a ? a.title : 'an article no longer here')) + '</span>' +
      '<span class="inv-row-meta">' + escHtml(formatDate(t.on || isoOf(new Date(t.at))) + ' · v' + (t.v || 1) + (t.by ? ' · by ' + t.by : '') + (t.score != null && t.score !== '' ? ' · check ' + t.score : '') + (t.note ? ' · ' + t.note : '')) + '</span></span></div>';
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
  var fault = a.kind === 'incident' && a.faultId ? kbFind(a.faultId) : null;
  if (a.kind === 'incident') meta.push(['Day', a.on ? formatDate(a.on) : ''], ['Fault', fault ? (kbCanRead(fault) ? fault.title : 'A fault you do not read') : '']);
  if (a.kind === 'decision') meta.push(['Decided', a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : 'Not yet'], ['Decided on', a.decidedOn ? formatDate(a.decidedOn) : ''], ['Review on', a.reviewOn ? formatDate(a.reviewOn) : '']);
  if (own) meta.push(['Read by', kbRolesText(a)], ['Version', kbVer(a) + (a.approvedAt ? ', ' + formatDate(isoOf(new Date(a.approvedAt))) : '')], ['Written by', a.by || ''], ['Source', a.src === 'import' ? 'soma-internal' + (a.srcRef ? ' · ' + a.srcRef : '') : '']);
  h += kbKvHtml(meta) + '</div>';
  // The rulings either side of this one, named only where this role reads them.
  var later = a.status === 'superseded' && a.supersededBy ? kbFind(a.supersededBy) : null, earlier = a.supersedes ? kbFind(a.supersedes) : null;
  if (a.status === 'superseded') h += '<div class="inv-callout inv-callout-warning">Replaced by a later ruling.' + (later && kbCanRead(later) ? ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(later.id) + '">Open it</button>' : '') + '</div>';
  if (earlier) h += '<div class="inv-callout inv-callout-info">' + (kbCanRead(earlier) ? 'Replaces: ' + escHtml(earlier.title) + ' <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbOpen" data-id="' + escHtml(earlier.id) + '">Open</button>' : 'Replaces an earlier ruling.') + '</div>';
  if (a.status === 'retired') h += '<div class="inv-callout inv-callout-neutral">Retired' + (a.retiredAt ? ' ' + escHtml(formatDate(isoOf(new Date(a.retiredAt)))) : '') + (a.retireReason ? ': ' + escHtml(a.retireReason) : '') + '</div>';
  // Why the owner said no: for the owner and the one who wrote what was declined, not every reader.
  var dec = a.declined, decMine = dec && (kbIsOwner() || (dec.change ? dec.change.byId != null && dec.change.byId === kbMe().id : kbMine(a)));
  if (decMine && (a.status === 'draft' || !a.pending)) h += '<div class="inv-callout inv-callout-warning">' + (dec.change ? 'A change by ' + escHtml(dec.change.by || 'someone') + ' was not approved' : 'Not approved') + (dec.reason ? ': ' + escHtml(dec.reason) : '') + '</div>';
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
  if (kbSeesProposal(a)) h += '<div class="inv-callout inv-callout-warning" data-kb-proposal>A change by ' + escHtml(a.pending.by || 'someone') + ' waits for approval' +
    (a.pending.at ? ' (' + escHtml(formatTimestamp(a.pending.at)) + ')' : '') + '. <button class="inv-btn inv-btn-link inv-btn-sm" data-action="invKbProposal" data-id="' + escHtml(a.id) + '">See the change</button></div>';
  if (a.kind === 'guide' && (a.quiz || []).length && kbLive(a)) h += '<div class="inv-panel inv-panel-flush" data-kb-quiz><div class="inv-panel-head"><span class="inv-panel-title">Check what was learnt <span class="inv-panel-count">' + a.quiz.length + '</span></span></div>' +
    '<div class="inv-panel-body inv-note">Asked when training is recorded from this article: ' + escHtml(a.quiz.map(function(q) { return q.q; }).join(' · ')) + '</div></div>';
  if ((a.versions || []).length) h += uiFoldHtml('kb-ver-' + a.id, '<span class="inv-panel-title">Earlier versions <span class="inv-panel-count">' + a.versions.length + '</span></span>', a.versions.slice().reverse().map(function(v) {
    return '<div class="inv-row"><button class="inv-row-main" data-action="invKbVersion" data-id="' + escHtml(a.id) + '" data-v="' + escHtml(String(v.v)) + '"><span class="inv-row-title">Version ' + escHtml(String(v.v)) + '</span>' +
      '<span class="inv-row-meta">' + escHtml([v.at ? formatTimestamp(v.at) : '', v.by ? 'by ' + v.by : ''].filter(Boolean).join(' · ')) + '</span></button></div>';
  }).join(''), false);
  h += kbActionsHtml(a);
  return h;
}
function kbLinkTypeName(t) { var x = KB_LINK_TYPES.find(function(r) { return r[0] === t; }); return x ? x[1] : t; }
/* What can be done to an article, by whom: [action, label, kind]. One primary at most. */
function kbActionList(a) {
  var own = a.src !== 'build', b = [], owner = kbIsOwner(), w = kbCanWrite();
  var prim = function() { return b.some(function(x) { return x[2] === 'primary'; }) ? 'secondary' : 'primary'; };
  if (own && owner && (a.status === 'pending' || (a.status === 'published' && a.pending))) b.push(['invKbApprove', 'Approve', 'primary'], ['invKbDecline', 'Decline', 'secondary']);
  if (own && owner && a.status === 'draft') b.push(['invKbPublish', 'Publish', 'primary']);
  if (kbCanEdit(a)) b.push(['invKbEdit', a.status === 'published' && !owner ? (a.pending ? 'Change your proposal' : 'Propose a change') : 'Edit', prim()]);
  if (kbCanReplace(a)) b.push(['invKbReplace', 'Replace with a new ruling', 'secondary']);
  if (w && a.kind === 'fault' && kbLive(a)) b.push(['invKbIncidentFor', 'Log an incident', 'secondary']);
  if (kbIsLesson(a) && kbTrainOk()) b.push(['invKbTrain', 'Record training', 'secondary']);
  // A decision's review is the owner's, like the decision (any reader could clear the owner's To-do task).
  if (own && owner && a.kind === 'decision' && kbLive(a)) b.push(['invKbReview', 'Record a review', kbReviewDue(a) ? prim() : 'secondary']);
  if (own && owner && a.status === 'published') b.push(['invKbRetire', 'Retire', 'ghost']);
  if (kbCanDelete(a)) b.push(['invKbDelete', 'Delete draft', 'ghost']);
  return b;
}
function kbActionsHtml(a) {
  var b = kbActionList(a);
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
    }).join('') + '</tbody></table></div><div class="inv-note inv-panel-body">Then: read when the figure was put on the decision' + (a.figuresAt ? ' (the first on ' + escHtml(formatDate(isoOf(new Date(a.figuresAt)))) + ')' : '') + ', and kept. Now: read from the book as it stands.</div></div>';
  if ((a.reviewed || []).length) h += '<div class="inv-panel inv-panel-flush" data-kb-reviews><div class="inv-panel-head"><span class="inv-panel-title">Reviews <span class="inv-panel-count">' + a.reviewed.length + '</span></span></div>' + a.reviewed.map(function(r) {
    return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + escHtml(formatDate(isoOf(new Date(r.at))) + (r.by ? ' · ' + r.by : '') + (r.verdict ? ' · ' + r.verdict : '')) + '</div>' +
      (r.note ? '<div class="inv-row-meta inv-row-wrap">' + escHtml(r.note) + '</div>' : '') + '</div></div>';
  }).join('') + '</div>';
  return h;
}

/* An incident's day, as the book has it: what was plated and by whom, what went into the baths, power cuts, attendance.
   Read each time, never copied (K3). Each from a screen this role opens, as that screen shows it: the crew's names and the
   heads on site with the roster (People or Floor), the plating with Production, the stock with Stock, the cuts with Power. */
function kbDayContextHtml(a) {
  var d = a.on;
  if (!d) return '';
  var links = Array.isArray(a.links) ? a.links.filter(Boolean) : [];
  var rows = [], part = kbNameKey(links.filter(function(l) { return l.type === 'part'; }).map(function(l) { return l.label || l.id; })[0] || '');
  var line = links.filter(function(l) { return l.type === 'line'; }).map(function(l) { return l.id; })[0] || '', names = kbSeesRoster();
  if (kbSeesPage('pageProduction')) try {
    prodIndex().live.filter(function(e) { return e.date === d && e.kind === 'plated'; }).forEach(function(e) {
      var p = kbNameKey((e.part || '') + (e.partNumber || ''));
      var match = (part && p.indexOf(part) >= 0) || (line && e.line === line);
      if (!match && (part || line)) return;
      var crew = names ? prodCrew(e) : null;
      rows.push({ k: 'Plated', t: (e.time || '') + ' · ' + prodLineName(e.line) + ' · ' + prodEntryTitle(e) + ' · ' + prodQtyText(e.qty, e.unit) + (crew && crew.names && crew.names.length ? ' · ' + crew.names.join(', ') : '') });
    });
  } catch (e) { /* production not readable: left out */ }
  if (kbSeesPage('pageStock')) try {
    stockData().entries.filter(function(e) { return e.date === d && !e.voided && (e.kind === 'received' || e.kind === 'charged' || e.kind === 'used'); }).forEach(function(e) {
      var it = stockItem(e.itemId);
      rows.push({ k: { received: 'Stock in', charged: 'Into the bath', used: 'Used' }[e.kind], t: (it ? it.name : 'a stock line') + ' · ' + stockFmtQty(e.qty) + ' ' + (it ? it.unit || '' : '') });
    });
  } catch (e) { /* stock not readable */ }
  if (kbSeesPage('pagePower')) try {
    prodDowntimeDay(d).forEach(function(c) { rows.push({ k: 'Power cut', t: (c.time || '?') + ' to ' + (c.to || 'not back') }); });
  } catch (e) { /* power not readable */ }
  if (names) try {
    var rec = (S.attendance || {})[d];
    // A mark's state is `st` (P / H / A); the count read `s` and `state`, which no mark has, so it was always 0.
    if (rec && rec.marks) { var on = Object.keys(rec.marks).filter(function(k) { var m = rec.marks[k]; return m && (m.st === 'P' || m.st === 'H'); }).length; rows.push({ k: 'On site', t: String(on) }); }
  } catch (e) { /* attendance not readable */ }
  return '<div class="inv-panel inv-panel-flush" data-kb-day><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml('That day in the book, ' + formatDate(d)) + '</span></div>' +
    (rows.length ? rows.slice(0, 40).map(function(r) { return '<div class="inv-row inv-row-auto inv-row-top"><div class="inv-row-main"><div class="inv-row-title">' + escHtml(r.k) + '</div><div class="inv-row-meta inv-row-wrap">' + escHtml(r.t) + '</div></div></div>'; }).join('')
      : '<div class="inv-empty">Nothing recorded that day' + (part || line ? ' for this part or line' : '') + '.</div>') + '</div>';
}

/* ---------- Writing ---------- */
function kbBlankForm(kind) {
  return { id: null, kind: kind || 'guide', title: '', summary: '', body: '', tags: '', readers: KB_READ_ROLES.slice(), links: [], images: [], uid: kbMe().id, v0: null, s0: null,
    f: { causes: [{ cause: '', check: '', fix: '' }], options: [{ label: '', case: '' }, { label: '', case: '' }], figures: [], quiz: [] } };
}
/* The form on an article: its text as it stands. The writer of a change still waiting gets their change back to work on;
   the owner edits the article itself (the proposal is approved or declined on its own, never taken in by an edit). */
function kbFormFrom(a) {
  var p = a.pending && !kbIsOwner() && a.pending.byId != null && a.pending.byId === kbMe().id ? a.pending : null;
  var src = p ? Object.assign({}, a, p.fields || {}, { title: p.title, summary: p.summary, body: p.body }) : a;
  var j = function(x) { return JSON.parse(JSON.stringify(x)); };
  return { id: a.id, kind: a.kind, title: src.title || '', summary: src.summary || '', body: src.body || '', tags: (src.tags || []).join(', '), readers: kbReadersOf(a.roles),
    links: j(src.links || []), images: j(src.images || []), uid: kbMe().id, v0: kbVer(a), s0: a.status, p0: a.pending ? a.pending.at : null,
    f: { ruledBy: src.ruledBy || '', ruledOn: src.ruledOn || '', supersedes: src.supersedes || '', symptom: src.symptom || '', causes: j(src.causes && src.causes.length ? src.causes : [{ cause: '', check: '', fix: '' }]),
      on: src.on || '', faultId: src.faultId || '', cause: src.cause || '', fix: src.fix || '', question: src.question || '', options: j(src.options && src.options.length ? src.options : [{ label: '', case: '' }]),
      chosen: src.chosen != null ? src.chosen : '', reason: src.reason || '', decidedOn: src.decidedOn || '', reviewOn: src.reviewOn || '', figures: j(src.figures || []), quiz: j(src.quiz || []) } };
}
/* The form, as a step over the place it opened from: Back closes it there. `extra` fills a new one (Replace, Log one). */
function kbOpenForm(id, kind, extra) {
  if (!kbCanWrite()) { showToast('Sign in to write', 'warning'); return; }
  var a = id ? kbOwnFind(id) : null;
  if (id && !(a && kbCanEdit(a))) { showToast(a && a.kind === 'ruling' && a.status === 'published' ? 'A ruling is replaced, never edited' : 'That article cannot be edited', 'warning'); return; }
  var tab = _kbTab;
  kbGo({ tab: 'pageKnow', v: tab + '/edit', id: id || '' }, function() {
    _kbEdit = a ? kbFormFrom(a) : kbBlankForm(kind);
    if (extra) Object.keys(extra).forEach(function(k) { if (k === 'f') Object.assign(_kbEdit.f, extra.f); else _kbEdit[k] = extra[k]; });
    _kbOpen = null;
  });
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
      (kbSeesPage('pageClients') ? _kbSel('Client (where the figure is one client’s)', 'figClient', '', (S.clients || []).slice().sort(function(x, y) { return String(x.name).localeCompare(String(y.name)); }).map(function(c) { return [c.id, c.name]; }), 'None') : '') + '</div>' +
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
    '<div class="inv-panel-body"><div class="inv-fields">' + _kbSel('Link to', 'linkType', kbLinkTypeOk(e.linkType), kbLinkTypes()) + kbLinkPickHtml(kbLinkTypeOk(e.linkType)) + '</div>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invKbLinkAdd">Add the link</button><div class="inv-note">The article shows on that record&rsquo;s screen.</div></div></div>';
  // Who reads it: the owner always. A change proposed to a published article leaves this as it is: who reads an article
  // is the owner's to change (an approved proposal had changed it without the owner seeing it).
  var proposal = a && a.status === 'published' && !owner;
  h += '<div class="inv-panel inv-panel-flush" data-kb-form-roles><div class="inv-panel-head"><span class="inv-panel-title">Who reads it</span></div><div class="inv-panel-body">' +
    (proposal ? '<div class="inv-note">' + escHtml(kbRolesText(a) + '. Only the owner changes who reads it.') + '</div>' :
    '<label class="inv-field-check"><input type="checkbox" checked disabled> Owner</label>' + KB_READ_ROLES.map(function(r) {
      return '<label class="inv-field-check"><input type="checkbox" data-kb-role="' + r + '"' + (e.readers.indexOf(r) >= 0 ? ' checked' : '') + '> ' + escHtml(grdRoleName(r)) + '</label>';
    }).join('') + '<div class="inv-note">All ticked: everyone reads it. None ticked: the owner only.</div>') + '</div></div>';
  h += _kbIn('Tags, separated by commas', 'tags', e.tags, 'text', { ph: 'pickling, safety' });
  h += '</div></div>';
  var send = owner ? 'Publish' : 'Send for approval';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(kbKindName(e.kind) + (owner ? ' · published at once' : ' · the owner approves it first')) + '</div></div>' +
    ((!a || a.status === 'draft' || a.status === 'pending') ? '<button class="inv-btn inv-btn-secondary" data-action="invKbSaveDraft">Save draft</button>' : '') +
    '<button class="inv-btn inv-btn-primary" data-action="invKbSave">' + send + '</button></div>';
  return h;
}
/* What an article may link to, by who is writing: a record's list only from a screen the role opens (the client and part
   pickers, the stock lines and the roster were listed to every role). */
var KB_LINK_PAGE = { client: 'pageClients', part: 'pageClients', stock: 'pageStock' };
function kbLinkTypes() {
  return KB_LINK_TYPES.filter(function(t) { return t[0] === 'worker' ? kbSeesRoster() : !KB_LINK_PAGE[t[0]] || kbSeesPage(KB_LINK_PAGE[t[0]]); });
}
function kbLinkTypeOk(t) { var ok = kbLinkTypes(); return ok.some(function(x) { return x[0] === t; }) ? t : ok[0][0]; }
function kbLinkPickHtml(type) {
  var opts = null;
  if (type === 'client') opts = (S.clients || []).slice().sort(function(x, y) { return String(x.name).localeCompare(String(y.name)); }).map(function(c) { return [c.id, c.name]; });
  else if (type === 'area') opts = STAFF_AREAS.map(function(x) { return [x.id, x.label]; });
  else if (type === 'line') opts = KB_LINES;
  else if (type === 'stock') opts = stockData().items.map(function(i) { return [i.id, i.name]; });
  else if (type === 'screen') opts = Object.keys(PAGE_TITLES).filter(function(k) { return k !== 'pageKnow' && kbSeesPage(k); }).map(function(k) { return [k, wsPageName(k)]; });
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
    // The option decided is the one picked, wherever the blank options before it fall: the list was filtered first and
    // the pick read as a place in it, so "Reprice" with a blank option above it was stored as "Exit".
    r.question = String(f.question || '').trim(); r.options = []; r.chosen = null;
    f.options.forEach(function(o, i) {
      if (!(o.label || '').trim()) return;
      if (f.chosen !== '' && f.chosen != null && +f.chosen === i) r.chosen = r.options.length;
      r.options.push({ label: String(o.label).trim(), case: String(o.case || '').trim() });
    });
    r.reason = String(f.reason || '').trim(); r.decidedOn = f.decidedOn || ''; r.reviewOn = f.reviewOn || ''; r.figures = f.figures.slice();
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
/* Figures a decision keeps: each read once, when it is put on the decision, and kept. A figure that could not be read then
   stays unread: read at a later edit, its "then" would be that day's (it had been re-read, and figuresAt moved). */
function kbFreezeFigures(r) {
  if (r.kind !== 'decision') return;
  var now = Date.now();
  (r.figures || []).forEach(function(g) {
    if (Object.prototype.hasOwnProperty.call(g, 'then')) return;
    var read = kbFigureRead(g);
    g.then = read ? { v: read.v, text: read.text } : null;
    g.at = now;
    if (!r.figuresAt) r.figuresAt = now;
  });
}
/* Saves the form. The article is looked at again first: since the form opened it may have been published, replaced,
   retired or deleted (another window, another device's import), or somebody else's change may now wait on it. */
async function kbSave(asDraft) {
  var e = _kbEdit;
  if (!e) return;
  if (!kbFormOk(e)) { _kbEdit = null; renderKnow(); return; }
  var r = kbFormRecord(), problem = kbFormProblem(r);
  if (problem && !asDraft) { uiAlert({ title: 'Not saved yet', body: problem }); return; }
  if (!r.title) { uiAlert({ title: 'Not saved yet', body: 'Give it a title.' }); return; }
  var a = e.id ? kbOwnFind(e.id) : null;
  if (e.id && !a) {
    if (!(await uiConfirm({ title: 'Deleted meanwhile', body: '"' + r.title + '" was deleted while it was open here. Save it as a new article?', okLabel: 'Save as new' }))) return;
    if (_kbEdit !== e) return;
    e.id = null;
  } else if (a) {
    if (!kbCanEdit(a)) {
      uiAlert({ title: 'Not saved', body: a.status === 'retired' ? 'This article was retired meanwhile.' : a.status === 'superseded' ? 'This article was replaced meanwhile.'
        : a.kind === 'ruling' && a.status === 'published' ? 'This ruling was published meanwhile: a ruling is replaced by a new one, never edited.'
        : a.pending ? 'A change by ' + (a.pending.by || 'someone') + ' now waits for the owner on this article. Yours can be proposed once it is approved or declined.' : 'You cannot edit this article.' });
      return;
    }
    if (kbVer(a) !== e.v0 || a.status !== e.s0) {
      var was = e.s0 === 'published' ? 'version ' + e.v0 : (KB_STATUS[e.s0] || KB_STATUS.draft)[1].toLowerCase();
      var now = a.status === 'published' ? 'version ' + kbVer(a) : (KB_STATUS[a.status] || KB_STATUS.draft)[1].toLowerCase();
      if (!(await uiConfirm({ title: 'Changed meanwhile', body: '"' + a.title + '" changed while this form was open (' + was + ' then, ' + now + ' now). Saving puts what is typed here over it; the version it replaces is kept.', okLabel: 'Save over it' }))) return;
      if (_kbEdit !== e || !kbCanEdit(a)) return;
    }
  }
  var me = kbMe(), owner = kbIsOwner(), now2 = Date.now(), roles = kbRolesFrom(e.readers), msg;
  kbFreezeFigures(r);
  if (!a) {
    a = Object.assign({ id: kbUid('kb'), src: 'app', version: 1, versions: [], by: me.name, byId: me.id, at: now2, editedAt: now2, roles: roles }, r);
    a.status = asDraft ? 'draft' : owner ? 'published' : 'pending';
    if (a.status === 'published') { a.approvedBy = me.name; a.approvedAt = now2; }
    kbData().articles.push(a);
    msg = a.status === 'published' ? kbPublished(a) : a.status === 'pending' ? 'Sent to the owner for approval' : 'Draft saved';
  } else if (a.status === 'draft' || a.status === 'pending') {
    kbApply(a, r); a.roles = roles; a.at = now2; a.editedAt = now2;
    if (r.figuresAt && !a.figuresAt) a.figuresAt = r.figuresAt;
    a.status = asDraft ? 'draft' : owner ? 'published' : 'pending';
    delete a.declined;
    if (a.status === 'published') { a.approvedBy = me.name; a.approvedAt = now2; msg = kbPublished(a); }
    else msg = a.status === 'pending' ? 'Sent to the owner for approval' : 'Draft saved';
  } else if (owner) {
    a.versions = (a.versions || []).concat([kbSnapshot(a)]);
    kbApply(a, r); a.roles = roles; a.version = kbVer(a) + 1; a.approvedBy = me.name; a.approvedAt = now2; a.editedAt = now2;
    if (r.figuresAt && !a.figuresAt) a.figuresAt = r.figuresAt;
    delete a.declined;
    // A change somebody proposed stays to be approved or declined: it was written on the version before this one.
    msg = 'Saved as version ' + a.version + (a.pending ? '. A change by ' + (a.pending.by || 'someone') + ' still waits' : '');
  } else {
    // A change to a published article waits beside it. Who reads it is not part of it (the owner's alone); it names the
    // version it was written on, so approving it over a later version asks first.
    var fields = Object.assign({}, r);
    delete fields.roles;
    a.pending = { by: me.name, byId: me.id, at: now2, v: kbVer(a), title: r.title, summary: r.summary, body: r.body, fields: fields };
    delete a.declined;
    msg = 'Your change waits for the owner';
  }
  if (!kbHasPane(_kbTab)) kbSetTab(kbTabFor(a.kind));
  _kbEdit = null;
  _pageTyped = false;
  _kbOpen = a.id;
  saveState();
  renderKnow();
  kbNavReplace();
  showToast(msg);
}
/* A ruling published: the one it replaces is marked superseded, both ways linked. Where that one had been replaced already,
   this replaces the ruling in force now (two published replacements of one ruling had both stood); a retired one is left
   retired and this one stands on its own. Returns the toast's words. */
function kbPublished(a) {
  if (a.kind !== 'ruling' || !a.supersedes) return 'Published';
  var res = kbSupersede(a);
  return res === 'moved' ? 'Published: it replaces the ruling in force, which had replaced the one named' : res === 'retired' ? 'Published: the ruling it was to replace had been retired' : 'Published';
}
function kbSupersede(a) {
  var old = kbOwnFind(a.supersedes), seen = {}, moved = false;
  while (old && old.status === 'superseded' && old.supersededBy && old.supersededBy !== a.id && !seen[old.id]) {
    seen[old.id] = true;
    var next = kbOwnFind(old.supersededBy);
    if (!next) break;
    old = next; moved = true;
  }
  if (!old || old.id === a.id) return '';
  if (old.status === 'retired') return 'retired';
  if (old.status === 'superseded') return '';
  old.status = 'superseded';
  old.supersededBy = a.id;
  old.supersededAt = Date.now();
  delete old.pending;
  if (moved) a.supersedes = old.id;
  return moved ? 'moved' : 'done';
}
/* Approve: a pending article is published; a waiting change becomes the next version. A change written on an earlier
   version than the article's now asks first: approving it puts its text over what was changed since. */
async function kbApprove(id) {
  var a = kbOwnFind(id), me = kbMe(), msg = 'Published';
  if (!a || !kbIsOwner()) return;
  if (a.status === 'published' && a.pending) {
    var p = a.pending;
    if (p.v && p.v !== kbVer(a) && !(await uiConfirm({ title: 'Written on an earlier version', body: 'This change was written on version ' + p.v + '; the article is at version ' + kbVer(a) + ' now. Approving it puts its text over the changes since (they stay in the earlier versions).', okLabel: 'Approve' }))) return;
    if (a.pending !== p || a.status !== 'published') return;
    a.versions = (a.versions || []).concat([kbSnapshot(a)]);
    var r = Object.assign({}, p.fields || {}, { title: p.title, summary: p.summary, body: p.body });
    delete r.roles;
    kbApply(a, r);
    a.version = kbVer(a) + 1; a.approvedBy = me.name; a.approvedAt = Date.now(); a.changedBy = p.by;
    delete a.pending;
    delete a.declined;
    msg = 'Approved as version ' + a.version;
  } else if (a.status === 'pending' || a.status === 'draft') {
    a.status = 'published'; a.approvedBy = me.name; a.approvedAt = Date.now();
    delete a.declined;
    msg = kbPublished(a);
  } else return;
  saveState();
  renderKnow();
  showToast(msg);
}
async function kbDecline(id) {
  var a = kbOwnFind(id);
  if (!a || !kbIsOwner() || !(a.status === 'pending' || a.pending)) return;
  var p = a.pending;
  var why = await uiPrompt({ title: 'Decline', label: 'Why (the writer reads this)', required: true });
  if (!why || a.pending !== p) return;
  var d = { at: Date.now(), by: kbMe().name, reason: String(why).trim() };
  if (a.status === 'published' && a.pending) { a.declined = Object.assign(d, { change: a.pending }); delete a.pending; }
  else { a.status = 'draft'; a.declined = d; }
  saveState();
  renderKnow();
  showToast('Declined');
}
/* Retire: the owner's, asked again with the PIN (a published article goes out of force). A change waiting on it goes
   with it: there is nothing left to approve it into. */
async function kbRetire(id) {
  var a = kbOwnFind(id);
  if (!a || !kbIsOwner() || a.status !== 'published') return;
  if (!(await guardAsk('voids', 'retire an article'))) return;
  var why = await uiPrompt({ title: 'Retire this article', label: 'Why it no longer holds', required: true });
  if (!why || a.status !== 'published') return;
  a.status = 'retired'; a.retiredAt = Date.now(); a.retireReason = String(why).trim(); a.retiredBy = kbMe().name;
  delete a.pending;
  saveState();
  renderKnow();
  showToast('Retired: it stays in the record');
}
/* Delete a draft never published: its writer's, or the owner's (asked again with the PIN when it is somebody else's).
   Its id is kept, so an import of an older file does not bring it back. */
async function kbDeleteDraft(id) {
  var a = kbOwnFind(id);
  if (!kbCanDelete(a)) return;
  if (!kbMine(a) && !(await guardAsk('voids', 'delete a draft'))) return;
  if (!(await uiConfirm({ title: 'Delete this draft?', body: '"' + (a.title || 'Untitled') + '" was never published. It goes for good.', okLabel: 'Delete', danger: true }))) return;
  if (!kbCanDelete(kbOwnFind(id))) return;
  var k = kbData();
  k.articles = k.articles.filter(function(x) { return x.id !== id; });
  if (!k.deleted.some(function(x) { return x.id === id; })) k.deleted.push({ id: id, at: Date.now(), by: kbMe().name });
  if (_kbOpen === id) _kbOpen = null;
  saveState();
  renderKnow();
  kbNavReplace();
  showToast('Draft deleted');
}
function kbShowVersion(id, v) {
  var a = kbFind(id), ver = a && kbCanRead(a) && (a.versions || []).find(function(x) { return String(x.v) === String(v); });
  if (!ver) return;
  dialogOpen('<div class="inv-dialog inv-dialog-wide">' + dialogHeadHtml(escHtml('Version ' + ver.v + ': ' + (ver.title || a.title))) + '<div class="inv-dialog-main">' +
    '<div class="inv-note">' + escHtml([ver.at ? formatTimestamp(ver.at) : '', ver.by ? 'by ' + ver.by : ''].filter(Boolean).join(' · ')) + '</div>' +
    (ver.summary ? '<p class="inv-kb-summary">' + escHtml(ver.summary) + '</p>' : '') + kbBodyHtml(ver.body) +
    (a.kind === 'fault' && Array.isArray(ver.causes) && ver.causes.length ? '<div class="inv-note">' + escHtml(ver.causes.map(function(c) { return c && c.cause; }).filter(Boolean).join(' · ')) + '</div>' : '') +
    '</div><div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button></div></div>', { dismiss: true });
}
/* A field of an article as words, to set a proposed change against the article now. */
function kbFieldText(k, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  if (k === 'tags') return v.join(', ');
  if (k === 'links') return v.map(function(l) { return kbLinkTypeName(l.type) + ': ' + kbLinkName(l); }).join(' · ');
  if (k === 'images') return todoPlural(v.length, 'photo');
  if (k === 'causes') return v.map(function(c, i) { return (i + 1) + '. ' + [c.cause, c.check ? 'check: ' + c.check : '', c.fix ? 'fix: ' + c.fix : ''].filter(Boolean).join(' · '); }).join(' / ');
  if (k === 'options') return v.map(function(o, i) { return (i + 1) + '. ' + o.label + (o.case ? ' (' + o.case + ')' : ''); }).join(' / ');
  if (k === 'figures') return v.map(kbFigureLabel).join(' · ');
  if (k === 'quiz') return v.map(function(q) { return q.q; }).join(' · ');
  if (k === 'faultId') { var f = kbFind(v); return f ? (kbCanRead(f) ? f.title : 'A fault you do not read') : String(v); }
  if (/^(ruledOn|on|decidedOn|reviewOn)$/.test(k)) return formatDate(v);
  return String(v);
}
var KB_FIELD_NAMES = { title: 'Title', summary: 'In one line', tags: 'Tags', links: 'Linked to', images: 'Photos', ruledBy: 'Ruled by', ruledOn: 'Ruled on', symptom: 'What you see',
  causes: 'Causes', on: 'The day', faultId: 'The fault', cause: 'Cause found', fix: 'Fix', question: 'The question', options: 'The options', chosen: 'Decided', reason: 'Why',
  decidedOn: 'Decided on', reviewOn: 'Review on', figures: 'Figures', quiz: 'The check' };
/* A proposed change, beside the article now: every field it changes (Approve takes them all), the text in full. */
function kbShowProposal(id) {
  var a = kbFind(id), p = a && a.pending;
  if (!p || !kbCanRead(a) || !kbSeesProposal(a)) return;
  var owner = kbIsOwner(), fields = Object.assign({}, p.fields || {}, { title: p.title, summary: p.summary }), rows = [];
  Object.keys(KB_FIELD_NAMES).forEach(function(k) {
    if (!Object.prototype.hasOwnProperty.call(fields, k)) return;
    var was = k === 'chosen' ? (a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : '') : a[k];
    var to = k === 'chosen' ? (fields.chosen != null && fields.options && fields.options[fields.chosen] ? fields.options[fields.chosen].label : '') : fields[k];
    if (JSON.stringify(was == null ? '' : was) === JSON.stringify(to == null ? '' : to)) return;
    rows.push([KB_FIELD_NAMES[k] + ' now', kbFieldText(k, was), true], [KB_FIELD_NAMES[k] + ' proposed', kbFieldText(k, to), true]);
  });
  var stale = p.v && p.v !== kbVer(a);
  dialogOpen('<div class="inv-dialog inv-dialog-wide">' + dialogHeadHtml(escHtml('A change to ' + a.title)) + '<div class="inv-dialog-main">' +
    '<div class="inv-note">' + escHtml('By ' + (p.by || 'someone') + ' · ' + formatTimestamp(p.at) + (p.v ? ' · written on version ' + p.v : '')) + '</div>' +
    (stale ? '<div class="inv-callout inv-callout-warning">' + escHtml('The article is at version ' + kbVer(a) + ' now: approving this puts its text over the changes since.') + '</div>' : '') +
    (rows.length ? kbKvHtml(rows) : '') +
    (p.body !== a.body ? '<h3 class="inv-kb-h">Proposed text</h3>' + (kbBodyHtml(p.body) || '<div class="inv-note">No text.</div>') + '<h3 class="inv-kb-h">Text now</h3>' + (kbBodyHtml(a.body) || '<div class="inv-note">No text.</div>')
      : '<div class="inv-note">The text is unchanged.</div>') +
    '</div><div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' +
    (owner ? '<button class="inv-btn inv-btn-secondary" data-action="invKbDecline" data-id="' + escHtml(a.id) + '">Decline</button><button class="inv-btn inv-btn-primary" data-action="invKbApprove" data-id="' + escHtml(a.id) + '">Approve</button>' : '') +
    '</div></div>', { dismiss: true });
}

/* ---------- Training given ---------- */
function kbTrainOpen(articleId, staffId) {
  if (typeof grdCan === 'function' && !grdCan('floor')) { grdRefuse('record training'); return; }
  if (!kbSeesRoster()) { uiAlert({ title: 'Record training', body: 'Training is recorded against the roster, which your ID does not open. Ask the owner.' }); return; }
  var from = articleId ? kbFind(articleId) : null;
  if (articleId && !(from && kbCanRead(from) && kbIsLesson(from))) { showToast('That article is not a lesson here', 'warning'); return; }
  var lessons = kbReadable().filter(kbIsLesson).sort(function(x, y) { return String(x.title).localeCompare(String(y.title)); });
  if (!lessons.length) { uiAlert({ title: 'No lesson yet', body: 'Training is recorded against a published how-to, process or fault article. Write or publish one first.' }); return; }
  var roster = staffActive();
  if (!roster.length) { uiAlert({ title: 'Nobody on the roster', body: 'Training is recorded against the roster (Floor → People → Roster).' }); return; }
  var pick = from ? [from.id] : [];
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Record training') + '<div class="inv-dialog-main"><div class="inv-fields">' +
    '<label class="inv-field"><span class="inv-field-label">Who was trained</span><select class="inv-select" id="kbTrainWho"><option value="">Pick the hand</option>' + roster.map(function(w) {
      return '<option value="' + escHtml(String(w.id)) + '"' + (String(staffId) === String(w.id) ? ' selected' : '') + '>' + escHtml(w.name) + '</option>';
    }).join('') + '</select></label>' +
    '<label class="inv-field"><span class="inv-field-label">On</span><input class="inv-input" type="date" id="kbTrainOn" value="' + localDateStr() + '" max="' + localDateStr() + '"></label></div>' +
    '<div class="inv-field"><span class="inv-field-label">Lessons</span>' + lessons.map(function(a) {
      var st = staffId != null ? kbTrainState(staffId, a).state : 'no';
      return '<label class="inv-field-check"><input type="checkbox" data-kb-train-a="' + escHtml(a.id) + '"' + (pick.indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + escHtml(a.title) +
        (st === 'yes' ? ' · trained' : st === 'due' ? ' · due again' : '') + '</label>';
    }).join('') + '</div>' +
    kbQuizHtml(from) +
    '<label class="inv-field"><span class="inv-field-label">Score on the check, if one was asked</span><input class="inv-input" id="kbTrainScore" placeholder="2 of 3"></label>' +
    '<label class="inv-field"><span class="inv-field-label">Note</span><input class="inv-input" id="kbTrainNote"></label></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button><button class="inv-btn inv-btn-primary" data-action="invKbTrainSave">Save</button></div></div>', { dismiss: true });
}
/* A lesson's check, asked in the dialog: one question a fieldset of choices, for the lesson the dialog opened from. The
   score is worked out on Save, for that lesson alone. */
function kbQuizHtml(a) {
  var qz = a && a.kind === 'guide' ? (a.quiz || []) : [];
  if (!qz.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-kb-quiz-ask="' + escHtml(a.id) + '"><div class="inv-panel-head"><span class="inv-panel-title">The check <span class="inv-panel-count">' + qz.length + '</span></span></div>' +
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
/* Training given: a floor entry, against the roster, on the version the lesson was at on the day it was given (a day in
   the past took today's version, and a lesson changed since read as up to date). The check's score is the lesson's it was
   asked for (its answers were scored against whichever lesson was ticked). */
function kbTrainSave() {
  if (!kbTrainOk()) { grdRefuse('record training'); return; }
  var who = (document.getElementById('kbTrainWho') || {}).value, w = who && staffById(who);
  var ids = Array.prototype.map.call(document.querySelectorAll('[data-kb-train-a]:checked'), function(el) { return el.getAttribute('data-kb-train-a'); });
  if (!w) { uiAlert({ title: 'Not saved', body: 'Pick who was trained.' }); return; }
  if (!ids.length) { uiAlert({ title: 'Not saved', body: 'Tick the lessons given.' }); return; }
  var on = (document.getElementById('kbTrainOn') || {}).value || localDateStr();
  if (on > localDateStr()) { uiAlert({ title: 'Not saved', body: 'Training is recorded once it is given: the day is in the future.' }); return; }
  var quizEl = document.querySelector('[data-kb-quiz-ask]'), quizFor = quizEl ? quizEl.getAttribute('data-kb-quiz-ask') : '';
  var asked = quizFor && ids.indexOf(quizFor) >= 0 ? kbQuizScore(kbFind(quizFor)) : null;
  var typed = String((document.getElementById('kbTrainScore') || {}).value || '').trim(), note = String((document.getElementById('kbTrainNote') || {}).value || '').trim();
  var me = kbMe(), n = 0;
  ids.forEach(function(id) {
    var a = kbFind(id);
    if (!a || !kbCanRead(a) || !kbIsLesson(a)) return;
    var score = id === quizFor && asked ? asked : typed;
    kbData().trained.push({ id: kbUid('kt'), staffId: w.id, name: w.name, articleId: a.id, v: kbVerOn(a, on), on: on, at: Date.now(), by: me.name, byId: me.id, score: score || null, note: note });
    n++;
  });
  closeOverlay();
  saveState();
  renderKnow();
  showToast(todoPlural(n, 'lesson') + ' recorded for ' + w.name);
}

/* ---------- A decision's review: the owner's ---------- */
async function kbReview(id) {
  var a = kbOwnFind(id);
  if (!a || !kbIsOwner() || a.kind !== 'decision' || !kbLive(a)) return;
  var note = await uiPrompt({ title: 'Review: ' + (a.question || a.title), label: 'Was it right? What do the figures say now?', required: true });
  if (!note) return;
  a.reviewed = (a.reviewed || []).concat([{ at: Date.now(), by: kbMe().name, note: String(note).trim(), now: (a.figures || []).map(function(g) { var r = kbFigureRead(g); return r ? r.text : null; }) }]);
  saveState();
  renderKnow();
  showToast('Review recorded');
}

/* ---------- Export and import (sep-kb v1) ---------- */
/* The whole knowledge base, every role's articles: the owner's to take out. */
function kbExport() {
  if (!kbIsOwner()) { grdRefuse('export the knowledge base'); return; }
  var k = kbData(), out = { format: 'sep-kb', version: 1, exportedAt: new Date().toISOString(), build: (document.querySelector('meta[name="app-build"]') || {}).content || '',
    articles: k.articles, trained: k.trained, paths: k.paths, deleted: k.deleted };
  var blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sep-kb-' + localDateStr() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
  showToast('Exported ' + todoPlural(k.articles.length, 'article'));
}
/* Import is the owner's, asked again with the PIN (it publishes what it brings). */
async function kbImport() {
  if (!kbIsOwner()) { grdRefuse('import knowledge'); return; }
  if (!(await guardAsk('imports', 'import knowledge'))) return;
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
/* ---- A file from outside, cleaned before anything of it reaches the book ----
   Every field is taken as the shape the app draws, or left out: a list that is not a list, a date that is not a date, a
   number written as text, a link to nothing (`links: [null]` threw on every client's screen and in the top bar). An id the
   app does not make (or one of its own guides', which it would shadow) refuses the article. The whole file is read first,
   so a bad article never leaves half a file merged. */
var KB_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
function _kbStr(v, max) { return typeof v === 'string' ? v.slice(0, max || 20000) : typeof v === 'number' && isFinite(v) ? String(v) : ''; }
function _kbDay(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z').getTime()) ? v : ''; }
function _kbNum(v) { var n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return isFinite(n) ? n : null; }
function _kbInt(v, min) { var n = _kbNum(v); return n == null ? null : Math.max(min == null ? 0 : min, Math.floor(n)); }
function _kbList(v, fn) { return Array.isArray(v) ? v.map(function(x) { return x && typeof x === 'object' ? fn(x) : null; }).filter(Boolean) : []; }
function kbCleanFields(x, out) {
  if (Array.isArray(x.tags)) out.tags = x.tags.map(function(t) { return _kbStr(t, 80).trim(); }).filter(Boolean);
  else out.tags = typeof x.tags === 'string' && x.tags.trim() ? x.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
  var types = KB_LINK_TYPES.map(function(t) { return t[0]; });
  out.links = _kbList(x.links, function(l) { return types.indexOf(l.type) >= 0 ? { type: l.type, id: _kbStr(l.id, 200), label: _kbStr(l.label, 300) } : null; });
  ['summary', 'body', 'ruledBy', 'symptom', 'cause', 'fix', 'question', 'reason'].forEach(function(k) { if (x[k] != null) out[k] = _kbStr(x[k]); });
  ['ruledOn', 'on', 'decidedOn', 'reviewOn'].forEach(function(k) { if (x[k] != null) out[k] = _kbDay(x[k]); });
  if (x.faultId != null) out.faultId = KB_ID_RE.test(String(x.faultId)) ? String(x.faultId) : '';
  if (x.causes != null) out.causes = _kbList(x.causes, function(c) { var r = { cause: _kbStr(c.cause), check: _kbStr(c.check), fix: _kbStr(c.fix) }; return r.cause.trim() ? r : null; });
  if (x.options != null) out.options = _kbList(x.options, function(o) { var r = { label: _kbStr(o.label, 500), case: _kbStr(o.case) }; return r.label.trim() ? r : null; });
  if (x.chosen != null) { var c = _kbInt(x.chosen); out.chosen = c != null && out.options && c < out.options.length ? c : null; }
  if (x.figures != null) out.figures = _kbList(x.figures, function(g) {
    if (!KB_FIGURES[g.key]) return null;
    var r = { key: g.key, args: g.args && typeof g.args === 'object' && g.args.client != null ? { client: _kbStr(g.args.client, 80) } : {} };
    if (Object.prototype.hasOwnProperty.call(g, 'then')) r.then = g.then && typeof g.then === 'object' ? { v: _kbNum(g.then.v), text: _kbStr(g.then.text, 200) } : null;
    if (_kbNum(g.at) != null) r.at = _kbNum(g.at);
    return r;
  });
  if (x.quiz != null) out.quiz = _kbList(x.quiz, function(q) {
    var opts = Array.isArray(q.options) ? q.options.map(function(o) { return _kbStr(o, 300).trim(); }).filter(Boolean) : [], ans = _kbInt(q.answer);
    return _kbStr(q.q, 500).trim() && opts.length >= 2 && ans != null && ans < opts.length ? { q: _kbStr(q.q, 500), options: opts, answer: ans } : null;
  });
  return out;
}
function kbCleanArticle(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  var id = String(x.id == null ? '' : x.id), kinds = KB_KINDS.map(function(k) { return k[0]; }), title = _kbStr(x.title, 500).trim();
  if (!KB_ID_RE.test(id) || /^app-/.test(id) || kinds.indexOf(x.kind) < 0 || !title) return null;
  var a = kbCleanFields(x, { id: id, kind: x.kind, title: title, summary: '', body: '' });
  a.status = KB_STATUS[x.status] ? x.status : 'draft';
  a.version = _kbInt(x.version, 1) || 1;
  a.src = x.src === 'app' ? 'app' : 'import';
  if (x.srcRef != null) a.srcRef = _kbStr(x.srcRef, 500);
  ['by', 'byId', 'approvedBy', 'changedBy', 'retireReason', 'retiredBy'].forEach(function(k) { if (x[k] != null && x[k] !== '') a[k] = _kbStr(x[k], 300); });
  ['at', 'approvedAt', 'retiredAt', 'supersededAt', 'figuresAt'].forEach(function(k) { var n = _kbNum(x[k]); if (n != null) a[k] = n; });
  if (a.at == null) a.at = Date.now();
  ['supersedes', 'supersededBy'].forEach(function(k) { if (x[k] != null && KB_ID_RE.test(String(x[k]))) a[k] = String(x[k]); });
  // Who reads it: the roles the app knows; a list naming none of them is the owner's alone, never everyone's.
  var known = ['owner'].concat(KB_READ_ROLES), roles = Array.isArray(x.roles) ? x.roles : typeof x.roles === 'string' && x.roles ? [x.roles] : [];
  a.roles = roles.filter(function(r) { return known.indexOf(r) >= 0; });
  if (roles.length && !a.roles.length) a.roles = ['owner'];
  if (a.roles.length > 1) a.roles = a.roles.filter(function(r) { return r !== 'owner'; });
  if (KB_READ_ROLES.every(function(r) { return a.roles.indexOf(r) >= 0; })) a.roles = [];
  a.reviewed = _kbList(x.reviewed, function(r) { var at = _kbNum(r.at); return at != null ? { at: at, by: _kbStr(r.by, 200), note: _kbStr(r.note) } : null; });
  a.versions = _kbList(x.versions, function(v) {
    var n = _kbInt(v.v, 1);
    if (!n || n >= a.version) return null;
    var r = kbCleanFields(v, { v: n, at: _kbNum(v.at), by: _kbStr(v.by, 200), title: _kbStr(v.title, 500), summary: _kbStr(v.summary), body: _kbStr(v.body) });
    r.images = [];
    return r;
  });
  a.images = [];   // photos never travel
  return a;
}
var KB_RANK = { draft: 0, pending: 1, published: 2, superseded: 3, retired: 3 };
/* Merged by id, the whole file cleaned first:
   - an article not here is added, unless it is a draft deleted here (its id kept in `deleted`);
   - a newer version replaces the one here, which is kept in its versions; the same version moves only its status on (a
     ruling replaced, an article retired, on the device that wrote the file);
   - what was decided here stands: an article retired or replaced here is not brought back, and a draft edited here since
     it came in keeps the edit (the file's newer copy is counted, not taken);
   - a change waiting here is kept; one waiting in the file stays on its device;
   - training is matched to the roster by name (a file's staff ids are another device's), and dropped and counted where
     nobody here has the name; a ruling the file publishes over another one here supersedes it. */
function kbImportData(obj, name) {
  var arts = obj && (Array.isArray(obj) ? obj : obj.format === 'sep-kb' || Array.isArray(obj.articles) ? obj.articles : null);
  if (!Array.isArray(arts)) { if (!addFileElsewhere(obj, name, 'kb')) uiAlert({ title: 'Not a knowledge file', body: 'The file is not a sep-kb export.' }); return null; }
  var k = kbData(), res = { added: 0, updated: 0, same: 0, kept: 0, refused: 0, deleted: 0, trained: 0, notOnRoster: 0, paths: 0 };
  var clean = [], seen = {};
  arts.forEach(function(x) {
    var a = kbCleanArticle(x);
    if (!a || seen[a.id]) { res.refused++; return; }
    seen[a.id] = true;
    clean.push(a);
  });
  var gone = {};
  k.deleted.forEach(function(d) { gone[d.id] = true; });
  var tomb = (obj && Array.isArray(obj.deleted) ? obj.deleted : []).filter(function(d) { return d && KB_ID_RE.test(String(d.id)) && !gone[String(d.id)]; })
    .map(function(d) { return { id: String(d.id), at: _kbNum(d.at) || Date.now(), by: _kbStr(d.by, 200) }; });
  tomb.forEach(function(d) { gone[d.id] = true; });
  var now = Date.now(), published = [];
  clean.forEach(function(a) {
    var have = kbOwnFind(a.id);
    if (!have) {
      if (gone[a.id]) { res.deleted++; return; }
      a.importedAt = now;
      k.articles.push(a);
      if (a.kind === 'ruling' && a.status === 'published' && a.supersedes) published.push(a);
      res.added++;
      return;
    }
    var hv = kbVer(have), av = kbVer(a), hr = KB_RANK[have.status] || 0, ar = KB_RANK[a.status] || 0;
    if (av < hv || (av === hv && ar <= hr)) { res.same++; return; }
    if (hr === 3) { res.kept++; return; }
    var editedHere = (have.status === 'draft' || have.status === 'pending') && have.editedAt && (!have.importedAt || have.editedAt > have.importedAt);
    if (editedHere || (av > hv && ar < hr)) { res.kept++; return; }
    if (av === hv) {
      // The same text, a later stage: the status and what goes with it.
      ['status', 'approvedBy', 'approvedAt', 'retiredAt', 'retireReason', 'retiredBy', 'supersededBy', 'supersededAt'].forEach(function(f) { if (a[f] !== undefined) have[f] = a[f]; });
      if (have.status !== 'published') delete have.pending;
    } else {
      var keep = { pending: have.pending, images: have.images };
      if (have.status !== 'draft' && have.status !== 'pending') a.versions = (have.versions || []).concat([kbSnapshot(have)]).concat(a.versions.filter(function(v) { return v.v > hv; }));
      Object.keys(have).forEach(function(kk) { delete have[kk]; });
      Object.assign(have, a);
      if (keep.pending && have.status === 'published') have.pending = keep.pending;
      if (keep.images && keep.images.length) have.images = keep.images;
    }
    have.importedAt = now;
    if (have.kind === 'ruling' && have.status === 'published' && have.supersedes) published.push(have);
    res.updated++;
  });
  published.forEach(function(a) { kbSupersede(a); });
  tomb.forEach(function(d) { k.deleted.push(d); });
  // Training, matched to the roster by name.
  (obj && Array.isArray(obj.trained) ? obj.trained : []).forEach(function(t) {
    if (!t || typeof t !== 'object' || !KB_ID_RE.test(String(t.id || '')) || !KB_ID_RE.test(String(t.articleId || '')) || k.trained.some(function(x) { return x.id === String(t.id); })) return;
    var name = _kbStr(t.name, 200).trim(), key = name ? staffNameKey(name) : '', rk = relayKey(name);
    var w = key && (S.staff || []).find(function(x) { return staffNameKey(x.name) === key || (x.relayNames || []).some(function(n) { return relayKey(n) === rk; }); });
    if (!w) { res.notOnRoster++; return; }
    k.trained.push({ id: String(t.id), staffId: w.id, name: w.name, articleId: String(t.articleId), v: _kbInt(t.v, 1) || 1, on: _kbDay(t.on) || null, at: _kbNum(t.at) || now,
      by: _kbStr(t.by, 200), score: t.score == null ? null : _kbStr(t.score, 40), note: _kbStr(t.note, 500) });
    res.trained++;
  });
  (obj && Array.isArray(obj.paths) ? obj.paths : []).forEach(function(p) {
    if (!p || typeof p !== 'object' || !KB_ID_RE.test(String(p.id || '')) || /^app-/.test(String(p.id)) || !Array.isArray(p.articles)) return;
    var q = { id: String(p.id), title: _kbStr(p.title, 200) || 'A path', role: ['owner'].concat(KB_READ_ROLES).indexOf(p.role) >= 0 ? p.role : '',
      articles: p.articles.map(function(x) { return _kbStr(x, 200); }).filter(Boolean) };
    var i = k.paths.findIndex(function(x) { return x.id === q.id; });
    if (i < 0) k.paths.push(q); else k.paths[i] = q;
    res.paths++;
  });
  var said = [res.added ? res.added + ' added' : '', res.updated ? res.updated + ' updated' : '', res.same ? res.same + ' already here' : '',
    res.kept ? res.kept + ' kept as changed here' : '', res.deleted ? res.deleted + ' deleted here, not brought back' : '',
    res.trained ? todoPlural(res.trained, 'training record') : '', res.notOnRoster ? res.notOnRoster + ' training not on the roster' : '',
    res.paths ? todoPlural(res.paths, 'path') : '', res.refused ? res.refused + ' refused' : ''].filter(Boolean).join(' · ');
  if (!res.added && !res.updated && !res.trained && !res.paths && !tomb.length) { uiAlert({ title: 'Nothing imported', body: 'Nothing in ' + (name || 'the file') + ' is new here' + (said ? ': ' + said : '') + '.' }); return res; }
  saveState();
  if (navPageOf() === 'pageKnow') renderKnow();
  showToast(said);
  return res;
}

/* ---------- Doors from elsewhere ---------- */
/* The views that list an article's kind: the Library every kind, Troubleshoot faults and incidents, Records the records. */
function kbTabHolds(tab, kind) {
  return tab === 'library' || (tab === 'troubleshoot' && (kind === 'fault' || kind === 'incident')) || (tab === 'records' && ['ruling', 'requirement', 'incident', 'decision'].indexOf(kind) >= 0);
}
/* Opens one article: beside its list on the desktop, on its own screen on the phone. From a list that holds it, on that
   list (Back returns there); from anywhere else, on its own kind's. A door inside a dialog holding typed work asks first:
   a client's Edit sheet lists its articles, and a tap had shut the sheet with what was typed in it. */
function kbOpenArticle(id) {
  var a = kbFind(id);
  if (!a || !kbCanRead(a)) { showToast('That article is not here', 'warning'); return; }
  if (dialogsTypedAsk(function() { kbOpenArticle(id); })) return;
  var tab = navPageOf() === 'pageKnow' && kbTabHolds(_kbTab, a.kind) ? _kbTab : kbTabFor(a.kind);
  kbGo({ tab: 'pageKnow', v: tab, id: a.id });
}
/* An article's address, for a new window (search.js): its own kind's list, open beside it. */
function kbLocOf(id) { var a = kbFind(id); return a && kbCanRead(a) ? { tab: 'pageKnow', v: kbTabFor(a.kind), id: a.id } : null; }
/* The guides for a screen, or the articles on a record: the Library filtered to them. */
function kbOpenFor(type, id, label) {
  if (dialogsTypedAsk(function() { kbOpenFor(type, id, label); })) return;
  kbGo({ tab: 'pageKnow', v: 'library', id: '' }, function() {
    _kbFilter = { q: '', kind: '', status: '', link: { type: type, id: id == null ? '' : String(id), label: label || '' } };
  });
}
/* The top bar's door: the guides for the screen on show, or Start where none is written. A form with unsaved work asks
   before it is left (nav.js NAV_LEAVE_ACTIONS). */
function kbHelp() {
  var tab = navPageOf();
  if (tab !== 'pageKnow' && kbLinkedTo('screen', tab).length) kbOpenFor('screen', tab, wsPageName(tab));
  else kbGo({ tab: 'pageKnow', v: 'start', id: '' });
}
/* A link's record, on its own screen: only a screen this role opens. */
var KB_LINK_GO_PAGE = { client: 'pageClients', part: 'pageClients', stock: 'pageStock', worker: 'pageStaff', area: 'pageStaff', line: 'pageProduction' };
function kbLinkGo(id, i) {
  var a = kbFind(id), l = a && kbCanRead(a) && Array.isArray(a.links) ? a.links[+i] : null;
  if (!l) return;
  if (dialogsTypedAsk(function() { kbLinkGo(id, i); })) return;
  var page = l.type === 'screen' ? l.id : KB_LINK_GO_PAGE[l.type];
  if (page && isPageId(page) && !kbSeesPage(page)) { showToast('Your ID doesn’t open ' + (PAGE_TITLES[page] || 'that screen'), 'warning'); return; }
  switch (l.type) {
    case 'client': if ((S.clients || []).some(function(c) { return String(c.id) === String(l.id); })) srchGo({ kind: 'client', id: l.id }); else kbOpenFor('client', l.id, l.label); return;
    case 'part': {
      var p = (S.items || []).find(function(x) { return String(x.id) === String(l.id) || kbNameKey(x.partNumber) === kbNameKey(l.label || l.id); });
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
    // A view starts as itself: a kind or the drafts picked on another view are not carried to one with no chip for them.
    case 'invKbTab': kbGo({ tab: 'pageKnow', v: btn.dataset.tab, id: '' }, function() { _kbFilter.kind = ''; _kbFilter.status = ''; _kbFilter.link = null; }); return true;
    case 'invKbOpen': kbOpenArticle(id); return true;
    case 'invKbClose': _kbOpen = null; renderKnow(); return true;
    // Back, or with no step before (an address opened as it is, a new window) the view the article is on.
    case 'invKbBack': if (navCanBack()) navBack(); else navApply({ tab: 'pageKnow', v: _kbTab, id: '' }); return true;
    case 'invKbFormCancel':
      if (navCanBack()) navBack();
      else navLeaveOk().then(function(ok) { if (ok) navApply({ tab: 'pageKnow', v: _kbTab, id: _kbEdit && _kbEdit.id ? _kbEdit.id : '' }); });
      return true;
    case 'invKbNew': kbOpenForm(null, btn.dataset.kind || (_kbFilter.kind || 'guide')); return true;
    case 'invKbEdit': kbOpenForm(id); return true;
    case 'invKbReplace': {
      var old = kbOwnFind(id);
      if (kbCanReplace(old)) kbOpenForm(null, 'ruling', { title: old.title, summary: old.summary, body: old.body, links: JSON.parse(JSON.stringify(old.links || [])), readers: kbReadersOf(old.roles), f: { supersedes: old.id, ruledOn: localDateStr() } });
      return true;
    }
    case 'invKbIncidentFor': {
      var fa = kbFind(id);
      if (!fa || fa.kind !== 'fault' || !kbCanRead(fa)) return true;
      kbOpenForm(null, 'incident', { title: fa.symptom || fa.title, links: JSON.parse(JSON.stringify((fa.links || []).filter(function(l) { return l && l.type !== 'article'; }))), f: { faultId: fa.id, on: localDateStr() } });
      return true;
    }
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
      // The option decided follows its option when one before it goes; it is undecided when it goes itself.
      if (L2 === 'options' && e.f.chosen !== '' && e.f.chosen != null) e.f.chosen = +e.f.chosen === i ? '' : +e.f.chosen > i ? +e.f.chosen - 1 : +e.f.chosen;
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbLinkAdd': {
      var e2 = _kbEdit, t = e2 && kbLinkTypeOk(e2.linkType), v = e2 && String(e2._linkId || '').trim();
      if (!e2) return true;
      if (!v) { showToast('Pick what to link to', 'warning'); return true; }
      // A part by its number as written; a record by its id, with its name as it reads now (an article's is read live:
      // its title is for the roles that read it).
      var l = t === 'part' ? { type: 'part', id: '', label: v } : { type: t, id: v, label: '' };
      if (t !== 'part' && t !== 'article') l.label = kbLinkName(l);
      if (!e2.links.some(function(x) { return x.type === l.type && String(x.id) === String(l.id) && x.label === l.label; })) e2.links.push(l);
      e2._linkId = '';
      _pageTyped = true;
      kbRedrawForm();
      return true;
    }
    case 'invKbFigAdd': {
      var e3 = _kbEdit, key = e3 && e3._figKey;
      if (!key || !KB_FIGURES[key] || !kbFigureSees(key)) { showToast('Pick a figure', 'warning'); return true; }
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
    case 'invKbShowDrafts': kbGo({ tab: 'pageKnow', v: 'library', id: '' }, function() { _kbFilter = { q: '', kind: '', status: 'draft', link: null }; }); return true;
    case 'invKbLinkClear': _kbFilter.link = null; keepScroll(renderKnow); return true;
    case 'invKbLinkGo': kbLinkGo(id, btn.dataset.i); return true;
    case 'invKbPath': { var p = kbPaths().find(function(x) { return x.id === id; }), first = p && kbPathArticles(p)[0]; if (first) kbOpenArticle(first.id); else kbGo({ tab: 'pageKnow', v: 'training', id: '' }); return true; }
    case 'invKbExport': kbExport(); return true;
    case 'invKbImport': kbImport(); return true;
    case 'invKbHelp': kbHelp(); return true;
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
    _kbEdit.readers = Array.prototype.filter.call(document.querySelectorAll('[data-kb-role]'), function(x) { return x.checked; }).map(function(x) { return x.getAttribute('data-kb-role'); });
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
/* Worked out for the whole book, as every rule is (the Windows widget reads that list), and shown to a role by what it
   needs (todo.js todoSees): approvals and reviews the owner's, training due again a floor entry against the roster. They
   had asked who was signed in, so the widget lost them and an office ID's review cleared the owner's task. */
var KB_RULES = [['kbPending', 'Knowledge: articles waiting for your approval'], ['kbReview', 'Knowledge: a decision due for review'], ['kbTrainDue', 'Knowledge: training due again after a lesson changed']];
KB_RULES.forEach(function(r) { TODO_RULES.push(r); TODO_CHECK_DEFAULTS[r[0]] = true; });
TODO_RULE_NEED.kbPending = 'owner';
TODO_RULE_NEED.kbReview = 'owner';
TODO_RULE_NEED.kbTrainDue = 'floor roster';
TODO_RULE_FNS.kbPending = function() {
  var wait = kbData().articles.filter(function(a) { return a.status === 'pending' || (a.status === 'published' && a.pending); });
  if (!wait.length) return [];
  return [{ key: 'kbPending', rule: 'kbPending', tone: 'amber', title: todoPlural(wait.length, 'article') + ' waiting for your approval',
    sub: wait.slice(0, 3).map(function(a) { return a.title; }).join(' · '), why: 'Knowledge', facts: wait.slice(0, 6).map(function(a) { return [a.pending ? 'Change' : kbKindName(a.kind), a.title + (a.pending ? ' (by ' + (a.pending.by || '?') + ')' : a.by ? ' (by ' + a.by + ')' : '')]; }),
    clears: 'Clears itself when each is approved or declined.', go: { kind: 'kb', tab: 'start' }, goLabel: 'Open Knowledge',
    // A snooze holds for these changes as they are: another sent to the same article brings the task back.
    sig: wait.map(function(a) { return a.id + ':' + (a.pending ? a.pending.at : a.at); }).sort().join(',') }];
};
TODO_RULE_FNS.kbReview = function() {
  return kbData().articles.filter(kbReviewDue).map(function(a) {
    return { key: 'kbReview:' + a.id, rule: 'kbReview', tone: 'amber', title: 'Review the decision: ' + (a.question || a.title), sub: 'Review set for ' + formatDate(a.reviewOn),
      why: 'Knowledge · decisions', facts: [['Decided', a.chosen != null && a.options && a.options[a.chosen] ? a.options[a.chosen].label : 'Not yet'], ['Review on', formatDate(a.reviewOn)]],
      clears: 'Clears itself when a review is recorded on the decision.', go: { kind: 'kb', id: a.id }, goLabel: 'Open the decision', sig: a.id + '|' + a.reviewOn };
  });
};
TODO_RULE_FNS.kbTrainDue = function() {
  var due = kbDueAgain();
  if (!due.length) return [];
  return [{ key: 'kbTrainDue', rule: 'kbTrainDue', tone: 'amber', title: todoPlural(due.length, 'training') + ' due again', sub: 'The lesson changed since it was given',
    // A lesson some roles do not read is not named here: the task is every floor role's.
    why: 'Knowledge · training', facts: due.slice(0, 8).map(function(x) { return [x.w.name, (x.a.roles && x.a.roles.length ? 'A lesson for some roles only' : x.a.title) + ' (v' + (x.t.v || 1) + ' given, v' + kbVer(x.a) + ' now)']; }),
    clears: 'Clears itself when the training is given again on the new version.', go: { kind: 'kb', tab: 'training' }, goLabel: 'Open Training', sig: due.map(function(x) { return x.t.id + ':' + kbVer(x.a); }).sort().join(',') }];
};
