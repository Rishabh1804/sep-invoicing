/* ===== G4 · THE MERGE =====
   docs/GUARD.md step 5 (owner, 1 Oct 2026: "The admin ID is the only one whose data survives and all other changes made by any
   other ID merges data into it but doesn't overwrite and gives a log of changes"); built when the owner chose it, 7 Oct 2026
   ("start with 3 and 4"). Sync had been one book written whole: a device that pushed over a copy it had not seen replaced the
   other device's work, and a pull replaced this one's. Now the two are merged.

   - **Three copies**: the one this device last exchanged with GitHub (the base, kept on the device beside the book:
     `synced` in the same IndexedDB store, `mrgBasePut`), this device's book, and GitHub's. Each store the change log tracks
     (CHG_TRACK, changelog.js) is merged record by record (by id, or the store's own key), and a record changed on both sides
     field by field. A change on one side only is taken. A record removed on one side and left alone on the other goes.
   - **Both changed the same thing differently: the owner's change stands** (owner, GUARD.md G4: "a change to something the owner
     changed since is held for the owner, and logged"). Which side is the owner's is read off each side's change log since the
     base (who changed that record); where both or neither are, the later change stands. **The other is never lost**: it is held
     (`S.mergeHeld`), listed for the owner (To-do `mergeHeld`, Settings → GitHub sync), who keeps what stands or uses the one held.
     A record removed on one side and changed on the other is kept, and the removal is held.
   - **Quiet fields** never conflict: a series' next number takes the higher (`MRG_MAX`); a push's stamp, the LME history,
     what a challan has billed (worked out again after the merge) take this device's, the other's filling what it lacks.
   - **After a merge** the book is migrated as a pull's is, and two invoices, credit notes or quotations carrying one number
     (two devices issuing offline) are held for the owner too. The change log is the union of both, and one line says what the
     merge took and held.
   - **Where it runs**: a push that finds GitHub moved merges first and pushes the merged book (auto-push too, which used to
     pause); a pull merges. Without a base (the first sync after this build, or a pull that replaced the book) there is nothing
     to merge from, and the old questions are asked; a merge is possible from the next sync on. Replacing the book from GitHub
     stays the owner's. */

// What a merge held is a container of the book, filled empty on an older one.
STATE_CONTAINERS.push('mergeHeld');

var MRG_BASE_KEY = 'synced';
var MRG_MAX = { invNextNum: 1, cnNextNum: 1, cardSeq: 1 };
var MRG_QUIET = { lastPushAt: 1, updatedAt: 1, lmeHistory: 1, recentVehicles: 1, billedQty: 1, billedNos: 1, invoiceIds: 1, invoiceId: 1,
  invoiced: 1, lastPos: 1, versions: 1 };
var MRG_HELD_MAX = 500;

/* ---------- The base: what this device last exchanged with GitHub ---------- */
function mrgBaseGet() {
  if (typeof idbOpen !== 'function') return Promise.resolve(null);
  return idbOpen().then(function(db) {
    if (!db) return null;
    return new Promise(function(resolve) {
      try {
        var req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(MRG_BASE_KEY);
        req.onsuccess = function() {
          var v = req.result;
          if (!v || typeof v.state !== 'string') return resolve(null);
          try { resolve({ at: v.at || 0, sha: v.sha || null, state: JSON.parse(v.state) }); } catch (e) { resolve(null); }
        };
        req.onerror = function() { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }).catch(function() { return null; });
}
function mrgBasePut(stateStr, sha) {
  if (typeof idbOpen !== 'function') return Promise.resolve(false);
  return idbOpen().then(function(db) {
    if (!db) return false;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ at: Date.now(), sha: sha || null, state: stateStr }, MRG_BASE_KEY);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = tx.onabort = function() { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }).catch(function() { return false; });
}
function mrgBaseClear() {
  if (typeof idbOpen !== 'function') return Promise.resolve();
  return idbOpen().then(function(db) {
    if (!db) return;
    return new Promise(function(resolve) {
      try { var tx = db.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).delete(MRG_BASE_KEY); tx.oncomplete = tx.onerror = tx.onabort = function() { resolve(); }; }
      catch (e) { resolve(); }
    });
  }).catch(function() {});
}

/* ---------- Walking three books ---------- */
function mrgGet(book, path) {
  var v = book;
  for (var parts = path.split('.'), i = 0; i < parts.length; i++) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[parts[i]];
  }
  return v;
}
function mrgSet(book, path, val) {
  var parts = path.split('.'), o = book;
  for (var i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
    o = o[parts[i]];
  }
  if (val === undefined) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = val;
}
function mrgArr(v) { return Array.isArray(v) ? v : []; }
function mrgIsObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function mrgJ(v) { return v === undefined ? undefined : JSON.stringify(v); }
/* The stores to merge, the union over the three books: the change log's own list, a parent's stores one level down, and any
   other top-level object or list as one store; the book's own figures (`#top`) apart. */
function mrgUnits(books) {
  var known = {}, out = [], seen = {};
  CHG_TRACK.forEach(function(sp) { known[sp.path] = sp; });
  var add = function(path, v) {
    if (seen[path]) return;
    seen[path] = true;
    var sp = known[path];
    if (sp) { out.push(sp); return; }
    if (Array.isArray(v)) out.push({ path: path, kind: 'arr', generic: true });
    else if (mrgIsObj(v)) out.push({ path: path, kind: 'cfg', generic: true });
  };
  books.forEach(function(b) {
    if (!mrgIsObj(b)) return;
    Object.keys(b).forEach(function(k) {
      var v = b[k];
      if (k.charAt(0) === '_' || k === 'changeLog' || k === 'changeLogDropped' || k === 'mergeHeld' || !(v !== null && typeof v === 'object')) return;
      if (CHG_PARENTS[k] && !Array.isArray(v)) {
        Object.keys(v).forEach(function(sk) { if (sk.charAt(0) !== '_') add(k + '.' + sk, v[sk]); });
        if (!seen[k + '.*']) { seen[k + '.*'] = true; out.push({ path: k + '.*', kind: 'scalars', parent: k }); }
        return;
      }
      add(k, v);
    });
  });
  out.push({ path: '#top', kind: 'scalars', parent: '' });
  return out;
}
/* A store's records by key: { keys: [in order], map: { key: record } }. A list with a record no id or key names is one value. */
function mrgRecs(sp, cont) {
  var res = { keys: [], map: {}, atomic: false };
  if (cont === undefined) return res;
  if (sp.kind === 'cfg') { res.keys.push(''); res.map[''] = cont; return res; }
  if (sp.kind === 'map') {
    if (!mrgIsObj(cont)) { res.atomic = true; return res; }
    Object.keys(cont).forEach(function(k) { res.keys.push(k); res.map[k] = cont[k]; });
    return res;
  }
  if (!Array.isArray(cont)) { res.atomic = true; return res; }
  for (var i = 0; i < cont.length; i++) {
    var r = cont[i], k = sp.key ? sp.key(r, i) : (r && typeof r === 'object' && r.id != null ? String(r.id) : null);
    if (k == null || res.map[k] !== undefined) { res.atomic = true; return res; }
    res.keys.push(k); res.map[k] = r;
  }
  return res;
}
/* The book's own figures, as a map: the top level's (or a parent's) values that are not objects. */
function mrgScalars(book, parent) {
  var o = parent ? (book && book[parent]) : book, out = {};
  if (!mrgIsObj(o)) return out;
  Object.keys(o).forEach(function(k) {
    var v = o[k];
    if (v !== null && typeof v === 'object') return;
    if (parent && CHG_TRACK.some(function(sp) { return sp.path === parent + '.' + k && sp.kind === 'skip'; })) return;
    out[k] = v;
  });
  return out;
}

/* ---------- Who stands: the owner's change, else the later one ---------- */
function mrgOwnerIds(book) {
  var ids = {};
  ((book && book.users) || []).forEach(function(u) { if (u && u.role === 'owner') ids[String(u.id)] = true; });
  return ids;
}
/* What each side's change log says of a record since the base: { owner: changed by the owner, at: the latest }. */
function mrgSideIndex(book, since) {
  var idx = {}, owners = mrgOwnerIds(book);
  ((book && book.changeLog) || []).forEach(function(e) {
    if (!e || (e.at || 0) <= since) return;
    var k = e.coll + '|' + (e.rid == null ? '' : String(e.rid));
    var x = idx[k] || (idx[k] = { owner: false, at: 0 });
    if (e.by != null && owners[String(e.by)]) x.owner = true;
    if ((e.at || 0) > x.at) x.at = e.at;
  });
  return idx;
}
function mrgWinner(ctx, coll, rid) {
  var k = coll + '|' + (rid == null ? '' : String(rid)), m = ctx.mineIdx[k] || {}, t = ctx.theirsIdx[k] || {};
  if (m.owner && !t.owner) return 'm';
  if (t.owner && !m.owner) return 't';
  if ((t.at || 0) > (m.at || 0)) return 't';
  if ((m.at || 0) > (t.at || 0)) return 'm';
  return ctx.prefer;
}

/* ---------- One value, three ways ---------- */
function mrgHold(ctx, sp, key, field, kept, keptSide, other, otherSide, rec, why) {
  var label = '';
  try { label = sp.label ? sp.label(rec || {}, key) : ''; } catch (e) { label = ''; }
  ctx.held.push({ id: 'MH-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), at: ctx.at, coll: sp.path === '#top' ? 'settings' : sp.path,
    rid: key === '' ? null : key, field: field || null, label: label || (sp.noun || sp.path) + (key ? ' ' + key : ''), why: why || 'both',
    kept: { side: keptSide, v: kept }, other: { side: otherSide, v: other }, status: 'open', from: ctx.from });
}
/* A record (or a whole store) three ways. Returns the value that stands; what does not is held. */
function mrgRecord(ctx, sp, key, b, m, t) {
  var sb = mrgJ(b), sm = mrgJ(m), st = mrgJ(t);
  if (sm === st) return m;
  if (sm === sb) { if (st !== undefined || sb !== undefined) ctx.taken++; return t; }
  if (st === sb) return m;
  // Removed on one side, changed on the other: kept, and the removal held.
  if (m === undefined || t === undefined) {
    var kept = m === undefined ? t : m, keptSide = m === undefined ? 't' : 'm';
    if (m === undefined) ctx.taken++;
    mrgHold(ctx, sp, key, null, kept, keptSide, undefined, keptSide === 'm' ? 't' : 'm', kept, 'removed');
    return kept;
  }
  // Changed on both: field by field when both are records.
  if (mrgIsObj(m) && mrgIsObj(t) && (b === undefined || mrgIsObj(b))) {
    var out = {}, w = null;
    Object.keys(m).concat(Object.keys(t).filter(function(f) { return !(f in m); })).forEach(function(f) {
      var fb = b ? b[f] : undefined, fm = m[f], ft = t[f], jb = mrgJ(fb), jm = mrgJ(fm), jt = mrgJ(ft), v;
      if (jm === jt) v = fm;
      else if (jm === jb) { v = ft; ctx.taken++; }
      else if (jt === jb) v = fm;
      else if (MRG_MAX[f] && typeof fm === 'number' && typeof ft === 'number') v = Math.max(fm, ft);
      else if (MRG_QUIET[f]) v = mrgIsObj(fm) && mrgIsObj(ft) ? Object.assign({}, ft, fm) : fm === undefined ? ft : fm;
      else {
        if (!w) w = mrgWinner(ctx, sp.path === '#top' ? 'settings' : sp.path, key === '' ? null : key);
        v = w === 'm' ? fm : ft;
        if (w === 't') ctx.taken++;
        mrgHold(ctx, sp, key, f, v, w, w === 'm' ? ft : fm, w === 'm' ? 't' : 'm', m);
      }
      if (v !== undefined) out[f] = v;
    });
    return out;
  }
  var w2 = mrgWinner(ctx, sp.path, key === '' ? null : key);
  mrgHold(ctx, sp, key, null, w2 === 'm' ? m : t, w2, w2 === 'm' ? t : m, w2 === 'm' ? 't' : 'm', m);
  if (w2 === 't') ctx.taken++;
  return w2 === 'm' ? m : t;
}
/* A store three ways: its records merged, this device's order kept and GitHub's new ones after it. */
function mrgStore(ctx, sp, b, m, t) {
  // A store kept quietly (the change log skips it: a record of use, a plan on show): this device's, else GitHub's.
  if (sp.kind === 'skip') return mrgJ(m) === mrgJ(b) ? t : m;
  var rb = mrgRecs(sp, b), rm = mrgRecs(sp, m), rt = mrgRecs(sp, t);
  if (rb.atomic || rm.atomic || rt.atomic) return mrgRecord(ctx, sp, '', b, m, t);
  if (sp.kind === 'cfg') return mrgRecord(ctx, sp, '', b, m, t);
  var keys = rm.keys.slice();
  rt.keys.forEach(function(k) { if (rm.map[k] === undefined) keys.push(k); });
  rb.keys.forEach(function(k) { if (keys.indexOf(k) < 0) keys.push(k); });
  var outArr = [], outMap = {};
  keys.forEach(function(k) {
    var v = mrgRecord(ctx, sp, k, rb.map[k], rm.map[k], rt.map[k]);
    if (v === undefined) return;
    if (sp.kind === 'map') outMap[k] = v; else outArr.push(v);
  });
  if (m === undefined && t === undefined) return undefined;
  return sp.kind === 'map' ? outMap : outArr;
}

/* Two records carrying one issued number, after the merge (two devices issuing offline): held for the owner. */
function mrgDupNumbers(ctx, book) {
  var check = function(list, path, num, live, noun) {
    var seen = {};
    (list || []).forEach(function(r) {
      if (!r || !live(r)) return;
      var n = num(r);
      if (!n) return;
      if (seen[n] && String(seen[n].id) !== String(r.id)) {
        ctx.held.push({ id: 'MH-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), at: ctx.at, coll: path, rid: String(r.id), field: null,
          label: noun + ' ' + n + ' twice', why: 'number', kept: { side: 'm', v: seen[n].id }, other: { side: 't', v: r.id }, status: 'open', from: ctx.from });
      } else seen[n] = r;
    });
  };
  check(book.invoices, 'invoices', function(i) { return i.displayNumber || i.invoiceNumber; }, function(i) { return i.status !== 'cancelled'; }, 'Invoice');
  check(book.creditNotes, 'creditNotes', function(n) { return n.displayNumber; }, function(n) { return n.status !== 'cancelled'; }, 'Credit note');
  check(book.quotations, 'quotations', function(q) { return q.displayNumber ? q.displayNumber + (q.rev ? ' Rev ' + q.rev : '') : ''; }, function(q) { return q.status !== 'draft'; }, 'Quotation');
}

/* The merge itself: three plain books in, one out, with what it took and what it held. Pure: no S, no storage. */
function mrgMerge(base, mine, theirs, opts) {
  opts = opts || {};
  var since = opts.baseAt || 0;
  var ctx = { at: Date.now(), from: opts.from || 'GitHub', prefer: opts.prefer || 'm', taken: 0, held: [],
    mineIdx: mrgSideIndex(mine, since), theirsIdx: mrgSideIndex(theirs, since) };
  var out = JSON.parse(JSON.stringify(mine));
  mrgUnits([base, mine, theirs]).forEach(function(sp) {
    if (sp.kind === 'scalars') {
      var sb = mrgScalars(base, sp.parent), sm = mrgScalars(mine, sp.parent), st = mrgScalars(theirs, sp.parent);
      var tgt = sp.parent ? (out[sp.parent] = mrgIsObj(out[sp.parent]) ? out[sp.parent] : {}) : out;
      var keys = {};
      [sb, sm, st].forEach(function(o) { Object.keys(o).forEach(function(k) { keys[k] = true; }); });
      Object.keys(keys).forEach(function(k) {
        var v;
        if (k.charAt(0) === '_') v = sm[k] !== undefined ? (sm[k] || st[k]) : st[k];   // a one-time flag: set on either side is set
        else if (MRG_MAX[k] && typeof sm[k] === 'number' && typeof st[k] === 'number' && sm[k] !== st[k] && sb[k] !== sm[k] && sb[k] !== st[k]) v = Math.max(sm[k], st[k]);
        else {
          var holder = {}, b1 = {}, m1 = {}, t1 = {};
          if (k in sb) b1[k] = sb[k]; if (k in sm) m1[k] = sm[k]; if (k in st) t1[k] = st[k];
          holder = mrgRecord(ctx, { path: sp.parent ? sp.parent + '.*' : '#top', noun: 'setting', label: function() { return k; } }, '', b1, m1, t1);
          v = holder ? holder[k] : undefined;
        }
        if (v === undefined) delete tgt[k]; else tgt[k] = v;
      });
      return;
    }
    var v = mrgStore(ctx, sp, mrgGet(base, sp.path), mrgGet(mine, sp.path), mrgGet(theirs, sp.path));
    mrgSet(out, sp.path, v);
  });
  // The change log: both sides' entries, once each, in time order.
  var seen = {}, log = [];
  mrgArr(mine && mine.changeLog).concat(mrgArr(theirs && theirs.changeLog)).forEach(function(e) {
    if (!e || !e.id || seen[e.id]) return;
    seen[e.id] = true; log.push(e);
  });
  log.sort(function(a, b) { return (a.at || 0) - (b.at || 0); });
  out.changeLog = typeof CHG_MAX_ENTRIES === 'number' ? log.slice(-CHG_MAX_ENTRIES) : log;
  // What was held before, on either side, stays (a settling made on one side is the one that counts).
  var hs = {}, held = [];
  mrgArr(mine && mine.mergeHeld).concat(mrgArr(theirs && theirs.mergeHeld)).forEach(function(h) {
    if (!h || !h.id) return;
    if (hs[h.id]) { if (h.status !== 'open' && hs[h.id].status === 'open') Object.assign(hs[h.id], h); return; }
    hs[h.id] = Object.assign({}, h); held.push(hs[h.id]);
  });
  mrgDupNumbers(ctx, out);
  out.mergeHeld = held.concat(ctx.held).slice(-MRG_HELD_MAX);
  return { book: out, taken: ctx.taken, held: ctx.held };
}

/* ---------- Taking a merged book in ---------- */
/* The merged book replaces S as a pull's does (its shape filled, its records migrated, what is worked out from it worked out
   again), with one line in the change log saying what the merge took and held. Unlike a pull it is anyone's: nothing of
   this device's is lost, and what both changed stands for the owner. */
function mrgAdopt(res, from) {
  var prev = S;
  try {
    S = res.book;
    ensureStateShape(S);
    migrateState();
  } catch (e) {
    S = prev;
    persistState();
    throw e;
  }
  if (typeof prodTouch === 'function') prodTouch();
  if (typeof _invalidateUsageCache === 'function') _invalidateUsageCache();
  if (typeof chgBaseline === 'function') {
    chgBaseline();
    chgAppend([{ id: chgUid(), at: Date.now(), by: chgBy(), dev: chgDev(), op: 'change', coll: 'book', rid: null,
      label: 'merged with ' + from + ': ' + res.taken + ' change' + (res.taken === 1 ? '' : 's') + ' taken' + (res.held.length ? ', ' + res.held.length + ' held for the owner' : ''),
      fields: [] }]);
  }
  if (typeof grdRecheck === 'function') grdRecheck();
  return S;
}
/* Which side stands where the change logs cannot say: the owner's own device, else GitHub's (the copy the owner works from). */
function mrgPrefer() {
  if (typeof grdOn === 'function' && grdOn()) return typeof grdIsOwner === 'function' && grdIsOwner() ? 'm' : 't';
  return 'm';
}
function mrgSideName(side, from) { return side === 'm' ? 'this device' : from || 'GitHub'; }

/* ---------- Held for the owner ---------- */
function mrgHeldOpen() { return (S && Array.isArray(S.mergeHeld) ? S.mergeHeld : []).filter(function(h) { return h.status === 'open'; }); }
function mrgValText(v) {
  if (v === undefined) return 'removed';
  if (v === null || v === '') return 'empty';
  if (typeof v === 'object') { var s = JSON.stringify(v); return s.length > 140 ? s.slice(0, 139) + '…' : s; }
  return String(v);
}
function mrgHeldRowHtml(h) {
  var where = (h.field ? h.field + ' on ' : '') + h.label;
  var why = h.why === 'removed' ? (h.other.v === undefined ? 'Removed on ' + mrgSideName(h.other.side, h.from) + ', changed on ' + mrgSideName(h.kept.side, h.from) + ': kept'
    : 'Removed on ' + mrgSideName(h.kept.side, h.from) + ', changed on ' + mrgSideName(h.other.side, h.from))
    : h.why === 'number' ? 'Two records carry this number: reissue or delete one'
    : 'Both changed it: ' + mrgSideName(h.kept.side, h.from) + '\'s stands';
  return '<div class="inv-row inv-row-2 inv-row-flow" data-held="' + escHtml(h.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(where) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(why) + (h.why === 'number' ? '' : ' · stands: ' + escHtml(mrgValText(h.kept.v)) + ' · held: ' + escHtml(mrgValText(h.other.v))) +
    ' · ' + escHtml(formatTimestamp(h.at)) + '</span></span>' +
    '<span class="inv-row-end">' + (h.why === 'number' ? '' : '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMrgUse" data-id="' + escHtml(h.id) + '">Use held</button>') +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMrgKeep" data-id="' + escHtml(h.id) + '">' + (h.why === 'number' ? 'Noted' : 'Keep') + '</button></span></div>';
}
function mrgHeldOpenDialog() {
  var list = mrgHeldOpen();
  dialogOpen('<div class="inv-dialog" data-mrg-held role="dialog" aria-modal="true" aria-labelledby="mrgTitle">' + dialogHeadHtml('<span id="mrgTitle">Held for you</span>') +
    '<div class="inv-note">Two devices changed the same thing before either saw the other\'s change. What stands is the owner\'s change, else the later one; the other is held here. Keep what stands, or use the one held.</div>' +
    '<div class="inv-panel inv-panel-flush inv-mt-8">' + (list.length ? list.map(mrgHeldRowHtml).join('') : '<div class="inv-empty">Nothing is held.</div>') + '</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>', { dismiss: true, replace: !!document.querySelector('[data-mrg-held]') });
}
/* Use the one held: written where it was, the value that stood held in its place, so the choice can be made again. */
function mrgUse(id) {
  var h = mrgArr(S.mergeHeld).find(function(x) { return x.id === id && x.status === 'open'; });
  if (!h) return;
  var path = h.coll === 'settings' ? '' : h.coll, val = h.other.v;
  if (h.coll === 'settings' || /\.\*$/.test(h.coll)) {
    var parent = h.coll === 'settings' ? S : S[h.coll.replace(/\.\*$/, '')];
    if (h.field) { if (val === undefined) delete parent[h.field]; else parent[h.field] = val; }
  } else {
    var sp = CHG_TRACK.find(function(x) { return x.path === path; }) || { path: path, kind: Array.isArray(mrgGet(S, path)) ? 'arr' : 'map' };
    var cont = mrgGet(S, path);
    if (sp.kind === 'cfg' || (h.rid == null && mrgIsObj(cont))) {
      if (h.field) { if (val === undefined) delete cont[h.field]; else cont[h.field] = val; } else mrgSet(S, path, val);
    } else if (sp.kind === 'map' && mrgIsObj(cont)) {
      if (h.field && mrgIsObj(cont[h.rid])) { if (val === undefined) delete cont[h.rid][h.field]; else cont[h.rid][h.field] = val; }
      else if (val === undefined) delete cont[h.rid]; else cont[h.rid] = val;
    } else if (Array.isArray(cont)) {
      var i = cont.findIndex(function(r, j) { return (sp.key ? sp.key(r, j) : r && r.id != null ? String(r.id) : null) === String(h.rid); });
      if (h.field && i >= 0) { if (val === undefined) delete cont[i][h.field]; else cont[i][h.field] = val; }
      else if (val === undefined) { if (i >= 0) cont.splice(i, 1); }
      else if (i >= 0) cont[i] = val; else cont.push(val);
    } else if (!h.field) mrgSet(S, path, val);
  }
  h.status = 'used'; h.settledAt = Date.now(); h.settledBy = typeof chgBy === 'function' ? chgBy() : null;
  saveState();
  if (typeof tabRedrawActive === 'function') tabRedrawActive();
  mrgHeldOpenDialog();
  if (typeof ghHeldSync === 'function') ghHeldSync();
  showToast('Used the change held');
}
function mrgKeep(id) {
  var h = mrgArr(S.mergeHeld).find(function(x) { return x.id === id && x.status === 'open'; });
  if (!h) return;
  h.status = 'kept'; h.settledAt = Date.now(); h.settledBy = typeof chgBy === 'function' ? chgBy() : null;
  saveState();
  mrgHeldOpenDialog();
  if (typeof ghHeldSync === 'function') ghHeldSync();
}
/* Settling what was held is the owner's (a P1 change: it writes a record). */
function mrgGate(fn) {
  if (typeof grdOn === 'function' && grdOn() && !grdIsOwner()) { showToast('What a merge held is the owner\'s to settle', 'warning'); return false; }
  return typeof grdGate !== 'function' || grdGate('users', 'settle a change held by a merge', fn);
}

/* ---------- The To-do: something held ---------- */
TODO_RULES.push(['mergeHeld', 'Sync: a change held by a merge, for the owner']);
TODO_CHECK_DEFAULTS.mergeHeld = true;
TODO_RULE_NEED.mergeHeld = 'owner';
TODO_RULE_FNS.mergeHeld = function() {
  var list = mrgHeldOpen();
  if (!list.length) return [];
  var nums = list.filter(function(h) { return h.why === 'number'; }).length;
  return [{ key: 'mergeHeld', rule: 'mergeHeld', tone: nums ? 'red' : 'amber',
    title: todoPlural(list.length, 'change') + ' held by a merge', sub: nums ? todoPlural(nums, 'number') + ' carried twice' : 'two devices changed the same thing', why: 'GitHub sync',
    facts: list.slice(0, 3).map(function(h) { return [h.label, h.why === 'number' ? 'number twice' : (h.field || 'the record')]; }),
    clears: 'Clears itself when each is kept or used.', go: { kind: 'mergeHeld' }, goLabel: 'Settle them', sig: list.map(function(h) { return h.id; }).join(',') }];
};

function mrgAction(action, btn) {
  switch (action) {
    case 'invMrgOpen': mrgHeldOpenDialog(); return true;
    case 'invMrgUse': { var id = btn.dataset.id; if (mrgGate(function() { mrgUse(id); })) mrgUse(id); return true; }
    case 'invMrgKeep': { var id2 = btn.dataset.id; if (mrgGate(function() { mrgKeep(id2); })) mrgKeep(id2); return true; }
  }
  return false;
}
