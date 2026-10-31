/* ===== The final confirmation screen: every new message sorted, conflicts asked, one save (mc*) =====
   Built to the contract in msgstore.js. The owner, 31 Oct 2026: "the parser should be able to sort every new message and then
   bring up a final confirmation screen up for me"; production messages "Always" wait for a tick, "but repetitive work must be
   designed better"; a roll that disagrees with marks typed by hand asks hand by hand.

   mcOpen({ importId } | { ids }) opens it over the S.messages records named: a full layer (a sheet on the phone, wide on the
   desktop), the messages grouped by the day they report and then by kind in the floor's order. Each says what it would write,
   worked out by its own reader without saving (parseRelayRoll, parseProdPaste with prodReviewResolve, parseStockMessage with
   resolveStockParse, parseCashMessage), whether the book holds it already (by the readers' own refusals), its red questions and
   how sure the sorter is. Rolls, stock and cash at 90% or more with no red question come ticked; production always waits, with a
   tick for a day's group, a tick for every message like one, and the keys on the desktop. Save writes the ticked messages
   through each reader's own save (relayApplyPlan, prodSaveCore, stockCommitPaste, cashSaveCore), in the floor's order, marks
   each message saved (msgMarkSaved) and says what changed. A message left unticked stays 'new'. */

var MC_ORDER = ['in', 'out', 'pickling', 'production', 'runs', 'power', 'stock', 'cash', 'checkin', 'payment', 'other'];
var MC_PROD = { pickling: true, production: true, runs: true, power: true };
var MC_TICK_AT = 0.9;   // the sorter's confidence a roll, stock or cash message must reach to come ticked
// A day-and-kind group's noun: "Tick the 6 pickling loads of 28 Oct".
var MC_NOUN = {
  in: ['in-time roll', 'in-time rolls'], out: ['out-time roll', 'out-time rolls'], pickling: ['pickling load message', 'pickling load messages'],
  production: ['barrel list', 'barrel lists'], runs: ['production message', 'production messages'], power: ['power cut message', 'power cut messages'],
  stock: ['stock message', 'stock messages'], cash: ['cash message', 'cash messages'], checkin: ['check-in', 'check-ins'],
  payment: ['weekly payment summary', 'weekly payment summaries'], other: ['message not read', 'messages not read']
};
var _mc = null;   // { ids, read: { id: reading }, tick: { id: bool }, open: { key: bool }, hand: { iso|id: bool }, done, scrim }

/* ---------- What each message would write ---------- */
/* The minute of the day WhatsApp sent it: relaySplit gives minutes, a record may carry a moment (ms). */
function mcMin(rec) {
  var a = rec && rec.sentAt;
  if (a == null || a === '') return null;
  a = Number(a);
  if (!isFinite(a)) return null;
  if (a < 2880) return Math.round(a);
  var d = new Date(a);
  return d.getHours() * 60 + d.getMinutes();
}
/* The message as the paste box is handed it: its WhatsApp line and its words, so each reader reads who sent it and when. */
function mcWaText(rec) {
  var min = mcMin(rec), on = rec.sentOn;
  if (!on || min == null || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return String(rec.text || '');
  var p = on.split('-'), who = String(rec.sentBy || 'Unknown').replace(/:/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Unknown';
  var hh = Math.floor(min / 60) % 24, mm = min % 60;
  return p[2] + '/' + p[1] + '/' + p[0] + ', ' + hh + ':' + String(mm).padStart(2, '0') + ' - ' + who + ': ' + String(rec.text || '');
}
/* How sure the reading is, set against 90%: the sorter's own word on this message (`conf`, tuned by the profile), and, where
   msgprofile.js has it, how often the sender's messages of this kind were read right (mpKindConf(kind, sender) → 0..1, or null
   where the sender has sent nothing of the kind yet): the lower of the two. Null is not known: the message waits for a tick. */
function mcConf(rec) {
  var own = typeof rec.conf === 'number' ? rec.conf : 0;
  if (typeof mpKindConf === 'function') {
    try {
      var c = mpKindConf(mcKindOf(rec), rec.sentBy || '');
      if (c === null) return null;
      if (typeof c === 'number' && isFinite(c)) return Math.min(own, c);
    } catch (e) { /* a profile never stops the screen */ }
  }
  return own;
}
function mcKindOf(rec) { return rec.fix && rec.fix.kind ? rec.fix.kind : rec.kind || 'other'; }
function mcIsProd(kind) { return !!MC_PROD[kind]; }
function mcRoll(rec) {
  return { sentBy: rec.sentBy || '', sentOn: rec.sentOn || null, sentAt: mcMin(rec), text: String(rec.text || ''), _mcId: rec.id };
}
/* A message read by its reader, nothing saved: { id, kind, day, conf, dup, red: [texts], amber, blocked, review, what: [lines],
   sum: { clients, NOS, KG }, key (its reader's own key, to find the same message twice), tickable, def }. */
function mcRead(rec) {
  var kind = mcKindOf(rec), o = { id: rec.id, rec: rec, kind: kind, day: rec.sentOn || '', conf: mcConf(rec), dup: null, red: [], amber: 0,
    blocked: null, review: null, what: [], sum: null, key: '', tickable: false, def: false };
  try {
    if (kind === 'in' || kind === 'out') mcReadRoll(rec, o);
    else if (mcIsProd(kind)) mcReadProd(rec, o);
    else if (kind === 'stock') mcReadStock(rec, o);
    else if (kind === 'cash') mcReadCash(rec, o);
    else if (kind === 'checkin') { o.blocked = 'Read with its own checks against a proxy.'; o.review = 'checkin'; }
    else if (kind === 'payment') o.blocked = 'Shown, never saved: the payout is worked out from the day’s marks.';
  } catch (e) {
    console.error(e);
    o.blocked = 'Its reader could not read it: open it in its review.';
    o.review = kind;
  }
  if (rec.status === 'saved') o.dup = 'Saved before';
  else if (rec.status === 'skipped') o.dup = 'Set aside as not a report';
  else if (rec.status === 'dup') o.dup = 'Older than what the book holds';
  // Production with a red question is answered in its review, as its own Save waits on it: it is never ticked here.
  o.tickable = !o.dup && !o.blocked && kind !== 'other' && !(mcIsProd(kind) && o.red.length);
  o.def = o.tickable && !mcIsProd(kind) && o.conf != null && o.conf >= MC_TICK_AT && !o.red.length;
  return o;
}
function mcReadRoll(rec, o) {
  var roster = relayRoster({}), r = parseRelayRoll(rec.text, roster, rec.sentOn || null,
    { exact: false, sentAt: mcMin(rec), night: typeof shiftNightFor === 'function' ? shiftNightFor : null });
  var days = Object.keys(r.days || {}).filter(function(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
  o.day = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : days[0] || o.day;
  o.key = relayHash(rec.text);
  if (relayPastes().some(function(p) { return p.hash === o.key; })) o.dup = 'Saved before';
  r.issues.forEach(function(is) { if (is.tone === 'red') o.red.push((is.n != null ? 'Line ' + is.n + ': ' : '') + is.text); else if (is.tone === 'amber') o.amber++; });
  if (!(S.staff || []).length) o.blocked = 'Add the roster first: People → Roster.';
  else if (!days.length) o.blocked = 'No date to put it on: open it in its review.';
  o.review = 'roll';
  days.forEach(function(iso) {
    var d = r.days[iso], c = { P: 0, H: 0, A: 0 };
    Object.keys(d.people || {}).forEach(function(id) { var st = d.people[id].st; c[st] = (c[st] || 0) + 1; });
    var cov = 0, blocks = 0, bh = 0;
    (d.extra || []).forEach(function(x) { if (x.kind === 'block') { blocks++; bh += Number(x.hours) || 0; } else cov += Number(x.hours) || 0; });
    var t = [attDayName(iso) + ' ' + stockShortDate(iso) + ': ' + c.P + ' present' + (c.H ? ', ' + c.H + ' half day' : '') + (c.A ? ', ' + c.A + ' absent' : '')];
    if (cov) t.push('EXTRA ' + formatNum(cov, cov % 1 ? 1 : 0) + ' h on the 8:30 shift');
    if (blocks) t.push(todoPlural(blocks, 'block') + ', ' + formatNum(bh, bh % 1 ? 1 : 0) + ' h');
    o.what.push(t.join(' · '));
  });
}
function mcReadProd(rec, o) {
  var msgs = parseProdPaste(mcWaText(rec), prodCtx()), items = 0;
  o.review = 'prod';
  msgs.forEach(function(m) { items += m.read.items.length; });
  o.key = msgs.map(function(m) { return m.hash; }).join('|');
  if (!items) { o.blocked = 'Its reader found no load, run or cut in it: open it in Messages.'; return; }
  o.day = msgs[0].read.date || o.day;
  var res = prodReviewResolve({ msgs: msgs, choices: {} }), saving = 0;
  if (msgs.every(function(m) { return !m.read.items.length || m.dup; })) o.dup = msgs.some(function(m) { return m.faceBy; }) ? 'Entered on a face already' : 'Saved before';
  var sum = { clients: [], NOS: 0, KG: 0 };
  res.rows.forEach(function(r) {
    var it = r.it;
    if (r.m.dup || r.twin) return;
    saving++;
    if (r.tone === 'red') r.issues.forEach(function(x) { if (x.tone === 'red') o.red.push(x.text); });
    else if (r.tone === 'amber') o.amber++;
    var cn = r.clientId != null ? prodClientName(r.clientId) : it.client || '';
    if (cn && sum.clients.indexOf(cn) < 0) sum.clients.push(cn);
    [[it.qty, it.unit], [it.qty2, it.unit2]].forEach(function(q) { if (q[0] != null && (q[1] === 'NOS' || q[1] === 'KG')) sum[q[1]] += Number(q[0]) || 0; });
    o.what.push(it.kind === 'downtime' ? 'Power cut ' + (it.time || '?') + ' to ' + (it.to || 'not back')
      : ({ pickled: 'Pickled', plated: 'Plated', arrived: 'Arrived' }[it.kind] || 'Entry') + (it.time ? ' ' + it.time : '') + ' · ' + (cn || 'no client') +
        (it.part ? ' · ' + it.part : '') + (it.gauge ? ' [' + it.gauge + ']' : '') + ' · ' + prodQtyText(it.qty, it.unit) +
        (it.kind === 'plated' ? ' · ' + prodLineName(r.line || it.line) : ''));
  });
  if (!saving && !o.dup) o.dup = 'Entered on a face already';
  o.sum = sum;
}
function mcStockParse(rec) {
  var text = mcWaText(rec), parsed = parseStockMessage(text);
  parsed.text = text;
  if (!parsed.to) { parsed.from = parsed.to = rec.sentOn || localDateStr(); parsed.noDate = true; }
  return parsed;
}
function mcReadStock(rec, o) {
  var parsed = mcStockParse(rec);
  o.review = 'stock';
  o.key = stockHash(parsed.text);
  if (!parsed.lines.length) { o.blocked = 'No numbered stock lines found: open it in its review.'; return; }
  o.day = parsed.to || o.day;
  var res = resolveStockParse(parsed, {});
  if (res.dup) o.dup = 'Saved before';
  res.lines.forEach(function(r) {
    var item = r.item || r.newItem, unit = item ? item.unit : r.src.unit;
    if (r.tone === 'red') r.issues.forEach(function(is) { if (is.level === 'red' || is.level === 'danger') o.red.push(r.src.n + ' · ' + is.text); });
    else if (r.tone === 'amber') o.amber++;
    var said = stockResultText(r, unit);
    o.what.push(r.src.n + ' · ' + (item ? item.name : r.src.name || 'No name') + (r.newItem ? ' (a new line)' : '') + (said ? ': ' + said : '') + (r.skip ? ' · not saved' : ''));
  });
  if (res.lines.some(function(r) { return r.tone === 'red'; }) && !o.red.length) o.red.push('A line needs you: open it in its review.');
}
function mcCashParse(rec) {
  var sent = rec.sentOn || localDateStr();
  return { read: parseCashMessage(rec.text, sent), sentOn: sent, hash: relayHash(rec.text) };
}
function mcReadCash(rec, o) {
  var c = mcCashParse(rec), p = c.read;
  o.review = 'cash';
  o.key = c.hash;
  o.day = c.sentOn;
  if (cashPastes().some(function(x) { return x.hash === c.hash && !x.voidedAt; })) o.dup = 'Saved before';
  p.issues.forEach(function(x) { if (x.tone === 'danger') o.red.push(x.text); else o.amber++; });
  if (!p.lines.some(function(ln) { return ln.amount > 0; })) o.blocked = 'Nothing with an amount: open it in its review.';
  else if (p.lines.some(function(ln) { return ln.amount > 0 && !ln.what; })) o.blocked = 'A line says what it was for nowhere: say it in its review.';
  p.lines.forEach(function(ln) { o.what.push((ln.what || 'Not said') + ' · ' + formatCurrency(ln.amount) + (ln.date ? ' · ' + stockShortDate(ln.date) : '')); });
  o.what.push('Total ' + formatCurrency(p.sum) + (p.total != null && Math.abs(p.total - p.sum) >= 0.5 ? ' (the message says ' + formatCurrency(p.total) + ')' : ''));
}

/* ---------- The set on screen ---------- */
function mcRecords(o) {
  o = o || {};
  if (o.importId) return msgStore().filter(function(r) { return r.importId === o.importId; });
  return (o.ids || []).map(msgById).filter(Boolean);
}
function mcSortKey(r) {
  var k = MC_ORDER.indexOf(r.kind);
  return [r.day || '9999', k < 0 ? 99 : k, r.rec.sentOn || '', mcMin(r.rec) == null ? 9999 : mcMin(r.rec)];
}
function mcCmp(a, b) {
  var x = mcSortKey(a), y = mcSortKey(b);
  for (var i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
  return 0;
}
function mcReadAll() {
  var seen = {};
  _mc.list = _mc.ids.map(msgById).filter(Boolean).map(mcRead).sort(mcCmp);
  _mc.read = {};
  // The same message twice in the set (a roll posted again): read once, as the paste box reads it once.
  _mc.list.forEach(function(r) {
    _mc.read[r.id] = r;
    if (!r.key || r.dup || r.kind === 'other') return;
    var k = r.kind + '|' + r.key;
    if (seen[k]) { r.dup = 'The same message is earlier here'; r.tickable = r.def = false; }
    seen[k] = true;
  });
}
function mcShown() { return _mc.list.filter(function(r) { return !r.dup; }); }
function mcTicked() { return mcShown().filter(function(r) { return r.tickable && _mc.tick[r.id]; }); }
function mcToLook() { return mcShown().filter(function(r) { return !r.tickable || (r.red.length && !_mc.tick[r.id]); }); }

/* The rolls ticked, in the order they are saved: by the day they report, the in-time roll first, then when they were sent. */
function mcRollMsgs(list) {
  return list.filter(function(r) { return r.kind === 'in' || r.kind === 'out'; }).map(function(r) { return mcRoll(r.rec); });
}
function mcRollPlan(list) {
  var msgs = mcRollMsgs(list);
  if (!msgs.length) return null;
  var rv = { text: msgs.map(function(m) { return m.text; }).join('\n\n'), msgs: msgs, choices: {} };
  return { rv: rv, plan: relayPlan(rv) };
}

/* ---------- The screen ---------- */
function mcOpen(o) {
  if (!S) return null;
  var recs = mcRecords(o);
  _mc = { ids: recs.map(function(r) { return r.id; }), tick: {}, open: {}, hand: {}, done: null, scrim: null, from: o || {} };
  mcReadAll();
  _mc.list.forEach(function(r) { if (r.def) _mc.tick[r.id] = true; });
  var scrim = dialogOpen(mcDialogHtml(), { dismiss: true });
  _mc.scrim = scrim;
  scrim.addEventListener('keydown', mcKeys);
  return scrim;
}
function mcDialogHtml() {
  return '<div class="inv-dialog inv-dialog-wide inv-mc" data-mc>' + dialogHeadHtml(_mc.done ? 'Saved from the messages' : 'Check the new messages') +
    '<div class="inv-mc-body" id="mcBody">' + (_mc.done ? mcDoneHtml() : mcBodyHtml()) + '</div>' + mcFootHtml() + '</div>';
}
/* Drawn again in place: the list keeps where it was scrolled, and the control that was pressed keeps the focus. */
function mcRedraw() {
  var scrim = _mc && _mc.scrim;
  if (!scrim || !scrim.isConnected) return;
  var body = scrim.querySelector('#mcBody'), top = body ? body.scrollTop : 0, a = document.activeElement, fk = a && a.closest && a.closest('[data-mc-k]');
  var k = fk ? fk.getAttribute('data-mc-k') : null;
  scrim.innerHTML = mcDialogHtml();
  var nb = scrim.querySelector('#mcBody');
  if (nb) nb.scrollTop = top;
  var el = k ? scrim.querySelector('[data-mc-k="' + k.replace(/"/g, '') + '"]') : null;
  if (el) el.focus({ preventScroll: true });
}
function mcTyped() { if (_mc && _mc.scrim) _mc.scrim.dataset.typed = '1'; }

/* A message's first lines, enough to know it by: its whole text is in Messages. */
function mcPreview(text) {
  var lines = String(text || '').split('\n'), first = lines.slice(0, 4).join('\n');
  return (first.length > 240 ? first.slice(0, 240) : first) + (lines.length > 4 || first.length > 240 ? ' …' : '');
}
function mcDayLabel(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? attDayName(iso) + ' ' + stockShortDate(iso) : 'No date'; }
function mcConfHtml(r) {
  if (r.kind === 'other') return uiDot('neutral', 'Not read');
  if (r.conf == null) return uiDot('neutral', 'New from this sender');
  var pct = Math.round(r.conf * 100);
  return uiDot(r.conf >= MC_TICK_AT ? 'ok' : 'warning', pct + '% sure');
}
function mcSumText(list) {
  var s = { clients: [], NOS: 0, KG: 0 };
  list.forEach(function(r) {
    if (!r.sum) return;
    r.sum.clients.forEach(function(c) { if (s.clients.indexOf(c) < 0) s.clients.push(c); });
    s.NOS += r.sum.NOS; s.KG += r.sum.KG;
  });
  var q = [];
  if (s.NOS) q.push(prodQtyText(s.NOS, 'NOS'));
  if (s.KG) q.push(prodQtyText(s.KG, 'KG'));
  var cl = s.clients.length ? s.clients.slice(0, 3).map(clientShortName).join(', ') + (s.clients.length > 3 ? ' and ' + (s.clients.length - 3) + ' more' : '') : 'no client written';
  return cl + (q.length ? ' · ' + q.join(' + ') : '');
}

function mcBodyHtml() {
  var shown = mcShown(), held = _mc.list.filter(function(r) { return r.dup; });
  var h = '';
  if (!_mc.list.length) return uiBlankHtml({ kind: 'empty', title: 'No new messages', body: 'Every message here is in the book already.' });
  // What the book holds already: left out, and said.
  if (held.length) {
    var hk = 'held';
    h += '<div class="inv-callout inv-callout-info inv-mb-8" id="mcHeld"><div>' + todoPlural(held.length, 'message is', 'messages are') + ' in the book already and ' +
      (held.length === 1 ? 'is' : 'are') + ' left out, so nothing counts twice.</div>' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invMsgMcFold" data-key="' + hk + '" data-mc-k="f:' + hk + '" aria-expanded="' + !!_mc.open[hk] + '">' + (_mc.open[hk] ? 'Hide them' : 'Show them') + '</button>' +
      (_mc.open[hk] ? '<div class="inv-mt-8">' + held.map(function(r) {
        return '<div class="inv-row inv-row-2 inv-row-muted" data-mc-held="' + escHtml(r.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(msgKindLabel(r.kind)) + ' · ' + escHtml(r.rec.sentBy || 'No sender') + '</span>' +
          '<span class="inv-row-meta">' + escHtml(mcDayLabel(r.day)) + '</span></span><span class="inv-row-end"><span class="inv-badge inv-badge-neutral">' + escHtml(r.dup) + '</span></span></div>';
      }).join('') + '</div>' : '') + '</div>';
  }
  h += mcHandHtml();
  // Grouped by day, then by kind in the floor's order.
  var days = [];
  shown.forEach(function(r) { var d = r.day || ''; if (days.indexOf(d) < 0) days.push(d); });
  days.forEach(function(day) {
    var inDay = shown.filter(function(r) { return (r.day || '') === day; });
    h += '<section class="inv-panel inv-panel-flush" data-mc-day="' + escHtml(day || 'none') + '"><div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(mcDayLabel(day)) +
      ' <span class="inv-panel-count">' + inDay.length + '</span></span></div>';
    MC_ORDER.forEach(function(kind) {
      var list = inDay.filter(function(r) { return r.kind === kind; });
      if (list.length) h += mcGroupHtml(day, kind, list);
    });
    h += '</section>';
  });
  return h;
}
/* A day's messages of one kind. Production is a summary row that opens to its messages, with one tick for them all; the
   messages not read are one row that opens; the rest are listed. */
function mcGroupHtml(day, kind, list) {
  var key = 'g:' + (day || 'none') + ':' + kind, ticks = list.filter(function(r) { return r.tickable; });
  var on = ticks.filter(function(r) { return _mc.tick[r.id]; }).length, noun = MC_NOUN[kind] || ['message', 'messages'];
  var prod = mcIsProd(kind), folded = prod || kind === 'other', open = folded ? !!_mc.open[key] : true;
  var h = '<div class="inv-mc-group" data-mc-group="' + escHtml(key) + '" data-kind="' + escHtml(kind) + '">';
  var label = msgKindLabel(kind) + ' · ' + list.length;
  var groupTick = ticks.length > 1 || prod ? '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgMcGroup" data-key="' + escHtml(key) + '" data-mc-k="t:' + escHtml(key) + '" data-on="' + (on === ticks.length ? '0' : '1') + '"' +
    (ticks.length ? '' : ' disabled') + '>' + escHtml((on === ticks.length && ticks.length ? 'Untick the ' : 'Tick the ') + todoPlural(ticks.length, noun[0], noun[1]).replace(/^1 /, '') + (/^\d{4}/.test(day) ? ' of ' + stockShortDate(day) : '')) + '</button>' : '';
  if (folded) {
    var sub = prod ? mcSumText(list) : list.slice(0, 2).map(function(r) { return String(r.rec.text || '').split('\n')[0].slice(0, 40); }).join(' · ');
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-mc-sum="' + escHtml(key) + '"><button class="inv-row-main" data-action="invMsgMcFold" data-key="' + escHtml(key) + '" data-mc-k="f:' + escHtml(key) + '" aria-expanded="' + open + '">' +
      '<span class="inv-row-title">' + escHtml(label) + '</span><span class="inv-row-meta inv-row-wrap">' + escHtml(sub) + '</span></button>' +
      '<span class="inv-row-end"><span class="inv-row-stack">' + (prod ? '<span class="inv-num" data-mc-on>' + on + ' of ' + ticks.length + ' ticked</span>' : '') +
      '<span class="inv-badge inv-badge-' + (prod ? (on ? 'ok' : 'warning') : 'neutral') + '">' + (prod ? (on ? 'Ticked' : 'Waits for you') : 'Not read') + '</span></span></span></div>';
    if (groupTick) h += '<div class="inv-mc-acts">' + groupTick + '</div>';
  } else {
    h += '<div class="inv-row-group" data-mc-head="' + escHtml(key) + '">' + escHtml(label) + '</div>';
    if (groupTick) h += '<div class="inv-mc-acts">' + groupTick + '</div>';
  }
  if (open) h += list.map(mcRowHtml).join('');
  return h + '</div>';
}
function mcRowHtml(r) {
  var rec = r.rec, ticked = !!_mc.tick[r.id], min = mcMin(rec), more = !!_mc.open['m:' + r.id];
  var meta = (rec.sentBy || 'No sender') + (min != null ? ' · ' + relayClockLabel(min) : '') + (rec.sentOn && rec.sentOn !== r.day ? ' · sent ' + stockShortDate(rec.sentOn) : '');
  var tone = r.red.length ? 'danger' : r.blocked ? 'neutral' : r.amber ? 'warning' : 'ok';
  var badge = r.kind === 'other' ? ['neutral', 'Not read'] : r.kind === 'payment' ? ['neutral', 'Shown, not saved'] : r.blocked ? ['warning', 'Its review'] :
    r.red.length ? ['danger', 'Needs you'] : ticked ? ['ok', 'Ticked'] : mcIsProd(r.kind) ? ['warning', 'Waits for you'] : ['neutral', 'Not ticked'];
  var h = '<div class="inv-row inv-row-auto inv-row-top" data-mc-row="' + escHtml(r.id) + '" data-kind="' + escHtml(r.kind) + '" data-tone="' + tone + '">';
  h += r.tickable ? '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invMsgMcTick" data-id="' + escHtml(r.id) + '" data-mc-k="c:' + escHtml(r.id) + '"' +
    (ticked ? ' checked' : '') + ' aria-label="Save this message"></label>' : '';
  h += '<div class="inv-row-main"><div class="inv-row-title">' + escHtml(msgKindLabel(r.kind)) + '</div><div class="inv-row-meta inv-row-wrap">' + escHtml(meta) + ' · ' + mcConfHtml(r) + '</div>';
  if (r.kind === 'other' || r.kind === 'payment' || r.kind === 'checkin') h += '<div class="inv-quote inv-mt-4">' + escHtml(mcPreview(rec.text)) + '</div>';
  var lines = r.what, shownLines = more ? lines : lines.slice(0, 3);
  if (shownLines.length) h += '<div class="inv-mc-what inv-mt-4" data-mc-what>' + shownLines.map(function(t) { return '<div class="inv-row-meta inv-row-wrap">' + escHtml(t) + '</div>'; }).join('') + '</div>';
  if (lines.length > 3) h += '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invMsgMcFold" data-key="m:' + escHtml(r.id) + '" data-mc-k="f:m:' + escHtml(r.id) + '" aria-expanded="' + more + '">' +
    (more ? 'Show less' : 'Show all ' + lines.length) + '</button>';
  r.red.slice(0, 3).forEach(function(t) { h += '<div class="inv-callout inv-callout-danger inv-mt-8" data-mc-red>' + escHtml(t) + '</div>'; });
  if (r.red.length > 3) h += '<div class="inv-note">' + todoPlural(r.red.length - 3, 'more question') + ' in its review.</div>';
  if (r.blocked) h += '<div class="inv-note inv-mt-4" data-mc-blocked>' + escHtml(r.blocked) + '</div>';
  var acts = [];
  if (mcIsProd(r.kind) && r.tickable && !r.red.length) acts.push('<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invMsgMcLike" data-id="' + escHtml(r.id) + '" data-mc-k="l:' + escHtml(r.id) + '">Tick every production message like this one</button>');
  if (r.review && (r.blocked || r.red.length)) acts.push('<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMsgMcReview" data-id="' + escHtml(r.id) + '">' + (r.review === 'checkin' ? 'Read the check-ins' : 'Open its review') + '</button>');
  if ((r.kind === 'other' || r.blocked || r.red.length) && typeof mvOpen === 'function') acts.push('<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMsgMcView" data-id="' + escHtml(r.id) + '">Open in Messages</button>');
  if (r.kind === 'other') acts.push('<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMsgMcNotReport" data-id="' + escHtml(r.id) + '">Not a report</button>');
  if (acts.length) h += '<div class="inv-mc-acts inv-mt-4">' + acts.join('') + '</div>';
  return h + '</div><div class="inv-row-end"><span class="inv-badge inv-badge-' + badge[0] + '">' + badge[1] + '</span></div></div>';
}
/* The marks typed by hand the ticked rolls would change, asked hand by hand: Keep what was typed unless the message is used. */
function mcHandHtml() {
  var rp = mcRollPlan(mcTicked());
  if (!rp) return '';
  var asks = relayHandAsks(rp.plan);
  if (!asks.length) return '';
  var h = '<div class="inv-panel inv-panel-flush" id="mcHand"><div class="inv-panel-head"><span class="inv-panel-title">Marks typed by hand <span class="inv-panel-count">' + asks.length + '</span></span></div>' +
    '<div class="inv-panel-body">' + relayHandNoteHtml(asks, _mc.hand, 'invMsgMcHandAll') + '</div>';
  var rows = asks.map(function(a) {
    var use = !!_mc.hand[relayHandKey(a.iso, a.id)];
    return { parts: ['<div class="inv-row inv-row-2" data-mc-hand="' + escHtml(relayHandKey(a.iso, a.id)) + '" data-use="' + (use ? '1' : '0') + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(a.w.name) + ' · ' + escHtml(mcDayLabel(a.iso)) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml('Typed by hand: ' + (a.prev.st === 'A' ? 'Absent' : areaLabel(a.prev.area) + ', ' + relayMarkText(a.prev)) +
        '. The message reads ' + (a.roll.st === 'A' ? 'Absent' : areaLabel(a.roll.area) + ', ' + relayMarkText(a.roll)) + '.') + '</span></span>' +
      '<span class="inv-row-end"><span class="inv-badge inv-badge-' + (use ? 'info' : 'warning') + '">' + (use ? 'From the message' : 'Kept') + '</span></span></div>',
      relayHandSegHtml('invMsgMcHand', a.iso, a.id, use)] };
  });
  h += uiMoreHtml('mc-hand', rows, { n: 3, noun: 'hands' });
  return h + '</div>';
}
function mcFootHtml() {
  if (_mc.done) return '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invMsgMcDone">Done</button></div>';
  var shown = mcShown(), can = shown.filter(function(r) { return r.tickable; }).length, on = mcTicked().length, look = mcToLook().length;
  return '<div class="inv-dialog-foot"><span class="inv-mc-count" data-mc-count>' + escHtml(on + ' of ' + can + ' ticked' + (look ? ' · ' + look + ' to look at' : '')) + '</span>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Not now</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invMsgMcSave"' + (on ? '' : ' disabled') + '>' + (on ? 'Save ' + todoPlural(on, 'message') : 'Nothing ticked') + '</button></div>';
}

/* ---------- Keys on the desktop: ↑ ↓ move between the messages, space ticks ---------- */
function mcKeys(e) {
  if (!_mc || _mc.done || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  if (!document.body.classList.contains('inv-desktop')) return;
  var t = e.target;
  if (t && t.matches && t.matches('input:not([type="checkbox"]), textarea, select')) return;
  var boxes = Array.prototype.slice.call(_mc.scrim.querySelectorAll('[data-mc-row] input.inv-check'));
  if (!boxes.length) return;
  var row = t && t.closest ? t.closest('[data-mc-row]') : null, i = row ? boxes.indexOf(row.querySelector('input.inv-check')) : -1;
  var j = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(boxes.length - 1, i + 1)) : (i < 0 ? boxes.length - 1 : Math.max(0, i - 1));
  e.preventDefault();
  boxes[j].focus();
  if (boxes[j].scrollIntoView) boxes[j].scrollIntoView({ block: 'nearest' });
}

/* ---------- The ticks ---------- */
function mcLikeOf(r) {
  var who = String(r.rec.sentBy || '').trim().toUpperCase();
  return mcShown().filter(function(x) { return x.tickable && x.kind === r.kind && !x.red.length && String(x.rec.sentBy || '').trim().toUpperCase() === who; });
}
function mcAction(action, btn) {
  if (action.indexOf('invMsgMc') !== 0) return false;
  if (!_mc) return true;
  var id = btn && btn.dataset ? btn.dataset.id : null, r = id ? _mc.read[id] : null;
  switch (action) {
    case 'invMsgMcTick':
      if (r && r.tickable) { _mc.tick[id] = !!btn.checked; mcTyped(); mcRedraw(); }
      break;
    case 'invMsgMcGroup': {
      var key = btn.dataset.key, parts = String(key).split(':'), day = parts[1] === 'none' ? '' : parts[1], kind = parts[2], v = btn.dataset.on === '1';
      mcShown().forEach(function(x) { if (x.tickable && x.kind === kind && (x.day || '') === day && (!v || !x.red.length || !mcIsProd(kind))) _mc.tick[x.id] = v; });
      if (mcIsProd(kind) && v) _mc.open[key] = true;
      mcTyped(); mcRedraw();
      break;
    }
    case 'invMsgMcLike':
      if (r) { var like = mcLikeOf(r); like.forEach(function(x) { _mc.tick[x.id] = true; }); mcTyped(); mcRedraw(); showToast('Ticked ' + todoPlural(like.length, 'message') + ' from ' + (r.rec.sentBy || 'no sender') + ' like this one'); }
      break;
    case 'invMsgMcFold': _mc.open[btn.dataset.key] = !_mc.open[btn.dataset.key]; mcRedraw(); break;
    case 'invMsgMcHand': _mc.hand[relayHandKey(btn.dataset.iso, btn.dataset.id)] = btn.dataset.use === '1'; mcTyped(); mcRedraw(); break;
    case 'invMsgMcHandAll': {
      var rp = mcRollPlan(mcTicked());
      if (rp) relayHandAsks(rp.plan).forEach(function(a) { _mc.hand[relayHandKey(a.iso, a.id)] = btn.dataset.use === '1'; });
      mcTyped(); mcRedraw();
      break;
    }
    case 'invMsgMcNotReport':
      if (r) { r.rec.status = 'skipped'; saveState(); r.dup = 'Set aside as not a report'; r.tickable = false; mcRedraw(); showToast('Set aside: not a report'); }
      break;
    case 'invMsgMcView': if (r) mcLeave(function() { mvOpen(r.id); }); break;
    case 'invMsgMcReview': if (r) mcLeave(function() { mcOpenReview(r); }); break;
    case 'invMsgMcSave': mcSave(); break;
    case 'invMsgMcDone': mcClose(); break;
    default: return false;
  }
  return true;
}
/* Leaving for another screen: what was ticked asks first, as any dialog holding typed work does. */
function mcLeave(go) {
  var scrim = _mc && _mc.scrim;
  dialogLeaveOk(scrim).then(function(ok) {
    if (!ok) return;
    mcClose();
    go();
  });
}
function mcClose() {
  var scrim = _mc && _mc.scrim;
  _mc = null;
  if (scrim && scrim.isConnected) { delete scrim.dataset.typed; dialogCloseScrim(scrim); }
  if (typeof tabRedrawActive === 'function' && document.querySelector('.inv-page-active')) tabRedrawActive();
}
/* The message in its reader's own review, where every question has its picker. */
function mcOpenReview(r) {
  var rec = r.rec, text = mcWaText(rec);
  if (r.review === 'roll') { relayOpen(text); relayRead(); }
  else if (r.review === 'prod') prodOpenPaste(text);
  else if (r.review === 'stock') relayOpenStock(text);
  else if (r.review === 'cash') cashReviewOpen(rec.text, rec.sentOn || localDateStr());
  else if (r.review === 'checkin') ckReviewOpen(text);
}

/* ---------- One save ---------- */
async function mcSave() {
  if (!_mc || _mc.done) return;
  var ticked = mcTicked();
  if (!ticked.length) { showToast('Tick the messages to save first', 'error'); return; }
  var floorKinds = ticked.filter(function(r) { return r.kind !== 'cash'; }), cashKinds = ticked.filter(function(r) { return r.kind === 'cash'; });
  var refused = [];
  // The guard (guard.js), asked once for the batch: the floor's entries a permission, the cash paid out the PIN.
  if (floorKinds.length && !grdOk('floor') && !(await guardAsk('floor', 'save the messages'))) { refused = refused.concat(floorKinds); floorKinds = []; }
  if (cashKinds.length && !grdOk('payments') && !(await guardAsk('payments', 'record cash paid out'))) { refused = refused.concat(cashKinds); cashKinds = []; }
  if (!_mc) return;
  var go = floorKinds.concat(cashKinds), out = { saved: [], skipped: [], left: [], days: {} };
  var day = function(iso) { var k = iso || ''; return out.days[k] || (out.days[k] = { marks: 0, extras: 0, overrides: 0, prod: 0, stock: 0, cash: 0, cashLines: 0 }); };
  refused.forEach(function(r) { out.left.push({ r: r, why: 'Your ID can’t save it' }); });
  var chrono = function(a, b) { return String(a.rec.sentOn || '').localeCompare(String(b.rec.sentOn || '')) || (mcMin(a.rec) || 0) - (mcMin(b.rec) || 0); };

  // 1. The rolls, in one reading: by day, the in-time roll before the out-time, as the paste box saves them.
  var rolls = go.filter(function(r) { return r.kind === 'in' || r.kind === 'out'; });
  if (rolls.length) {
    var rp = mcRollPlan(rolls), plan = rp.plan;
    plan.issues.forEach(function(is) { if (is.tone === 'amber' && is.key && is.id != null) relayRemember(is.key, is.id); });
    plan.days.forEach(function(d) {
      var t = day(d.iso);
      d.rows.forEach(function(r) {
        if (r.change === 'new' || r.change === 'updated') t.marks++;
        else if (r.change === 'kept' && r.hand && r.differs && r.w && _mc.hand[relayHandKey(d.iso, r.w.id)]) { t.marks++; t.overrides++; }
      });
      d.extras.forEach(function(x) { if (!x.dup && !x.kept) t.extras++; });
    });
    relayApplyPlan(rp.rv, plan, { useMsg: _mc.hand });
    rp.rv.msgs.forEach(function(m) {
      var r = _mc.read[m._mcId];
      if (m.rpId) { msgMarkSaved(r.id, 'relayPastes', m.rpId); out.saved.push(r); }
      else if (m.dup || m.repeat) out.skipped.push({ r: r, why: m.dup ? 'Saved before' : 'The same roll is earlier here' });
      else out.left.push({ r: r, why: 'No date to put it on' });
    });
  }

  // 2. Production, in one reading in the order the messages were sent (a power back closes the cut before it).
  var prod = go.filter(function(r) { return mcIsProd(r.kind); }).sort(chrono);
  for (var pass = 0; pass < 2 && prod.length; pass++) {
    var spans = [], msgs = [];
    prod.forEach(function(r) {
      var mine = parseProdPaste(mcWaText(r.rec), prodCtx()).length;
      spans.push({ r: r, from: msgs.length, to: msgs.length + mine });
      msgs.length += mine;
    });
    msgs = parseProdPaste(prod.map(function(r) { return mcWaText(r.rec); }).join('\n'), prodCtx());
    var rv = { msgs: msgs, choices: {} }, res = prodReviewResolve(rv);
    if (res.red) {
      // A question only the whole set raises: that message is left to its review, and the rest read again.
      var redMi = {};
      res.rows.forEach(function(row) { if (row.tone === 'red' && !row.m.dup && !row.twin) redMi[row.mi] = true; });
      var keep = [];
      spans.forEach(function(sp) {
        var red = false;
        for (var i = sp.from; i < sp.to; i++) if (redMi[i]) red = true;
        if (red) out.left.push({ r: sp.r, why: 'A question needs you in its review' }); else keep.push(sp.r);
      });
      prod = keep;
      continue;
    }
    var before = prodData().entries.length;
    var done = prodSaveCore(rv, res, stockBy());
    if (done.n || done.closed) prodTouch();
    prodData().entries.slice(before).forEach(function(e) { day(e.date).prod++; });
    spans.forEach(function(sp) {
      var ids = [];
      for (var i = sp.from; i < sp.to; i++) if (done.pasteIds[i]) ids.push(done.pasteIds[i]);
      if (ids.length) { ids.forEach(function(pid) { msgMarkSaved(sp.r.id, 'production.pastes', pid); }); out.saved.push(sp.r); }
      else out.skipped.push({ r: sp.r, why: 'Saved before' });
    });
    break;
  }

  // 3. Stock, a message at a time, as Stock's paste check saves one.
  go.filter(function(r) { return r.kind === 'stock'; }).sort(chrono).forEach(function(r) {
    var parsed = mcStockParse(r.rec);
    if (!parsed.lines.length) { out.left.push({ r: r, why: 'No stock lines read' }); return; }
    var res = resolveStockParse(parsed, {});
    if (res.dup) { out.skipped.push({ r: r, why: 'Saved before' }); return; }
    var st = stockData(), before = st.entries.length;
    var made = stockCommitPaste(parsed, res, { sentBy: parsed.sentBy, by: stockBy(), choices: {} });
    if (!made.entries) { out.left.push({ r: r, why: 'Nothing to save: a line needs its name in its review' }); return; }
    st.entries.slice(before).forEach(function(e) { day(e.date).stock++; });
    msgMarkSaved(r.id, 'stock.pastes', st.pastes[st.pastes.length - 1].id);
    out.saved.push(r);
  });

  // 4. Cash paid out, as its review saves it with nothing changed.
  cashKinds.sort(chrono).forEach(function(r) {
    var c = mcCashParse(r.rec);
    if (cashPastes().some(function(x) { return x.hash === c.hash && !x.voidedAt; })) { out.skipped.push({ r: r, why: 'Saved before' }); return; }
    var lines = c.read.lines.filter(function(ln) { return ln.amount > 0; }).map(function(ln) { return { what: ln.what, cat: ln.cat, date: ln.date || null, amount: ln.amount, n: ln.n }; });
    if (!lines.length || lines.some(function(ln) { return !ln.what; })) { out.left.push({ r: r, why: 'A line needs saying what it was for' }); return; }
    var saved = cashSaveCore({ text: r.rec.text, hash: c.hash, sentOn: c.sentOn, week: attWeekStartOf(c.sentOn) }, lines);
    lines.forEach(function(ln) { var t = day(ln.date || c.sentOn); t.cashLines++; t.cash = gstRound(t.cash + ln.amount); });
    msgMarkSaved(r.id, 'cashPastes', saved.msgId);
    out.saved.push(r);
  });

  if (out.saved.length || out.left.length) saveState();
  // What was not ticked waits, 'new', and is listed with what is left to look at.
  mcShown().forEach(function(r) { if (!_mc.tick[r.id] || !r.tickable) out.left.push({ r: r, why: !r.tickable ? (r.blocked || 'Not read') : r.red.length ? 'A question needs you' : 'Not ticked' }); });
  _mc.done = out;
  if (_mc.scrim) delete _mc.scrim.dataset.typed;
  mcRedraw();
  showToast(out.saved.length ? 'Saved ' + todoPlural(out.saved.length, 'message') : 'Nothing saved', out.saved.length ? 'success' : 'error');
}
function mcDoneHtml() {
  var o = _mc.done, h = '';
  h += '<div class="inv-tiles inv-tiles-3" id="mcDoneTiles">' +
    '<div class="inv-tile inv-tile-ok" data-tile="saved"><div class="inv-tile-label">Saved</div><div class="inv-tile-value">' + o.saved.length + '</div></div>' +
    '<div class="inv-tile" data-tile="skipped"><div class="inv-tile-label">Left out</div><div class="inv-tile-value">' + o.skipped.length + '</div></div>' +
    '<div class="inv-tile' + (o.left.length ? ' inv-tile-warning' : '') + '" data-tile="left"><div class="inv-tile-label">To look at</div><div class="inv-tile-value">' + o.left.length + '</div></div></div>';
  var days = Object.keys(o.days).sort();
  if (days.length) {
    h += '<div class="inv-panel inv-panel-flush" id="mcDoneDays"><div class="inv-panel-head"><span class="inv-panel-title">What changed</span></div>';
    days.forEach(function(iso) {
      var t = o.days[iso], said = [];
      if (t.marks) said.push(todoPlural(t.marks, 'mark') + (t.overrides ? ' (' + t.overrides + ' over what was typed)' : ''));
      if (t.extras) said.push(todoPlural(t.extras, 'EXTRA row'));
      if (t.prod) said.push(todoPlural(t.prod, 'production entry', 'production entries'));
      if (t.stock) said.push(todoPlural(t.stock, 'stock entry', 'stock entries'));
      if (t.cashLines) said.push(todoPlural(t.cashLines, 'cash line') + ', ' + formatCurrency(t.cash));
      if (!said.length) return;
      h += uiFactRowHtml({ label: escHtml(mcDayLabel(iso)), value: escHtml(said.join(' · ')), attrs: ' data-mc-done-day="' + escHtml(iso) + '"' });
    });
    h += '</div>';
  }
  var row = function(x, tone) {
    var r = x.r;
    return '<div class="inv-row inv-row-2" data-mc-done="' + escHtml(r.id) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(msgKindLabel(r.kind)) + ' · ' + escHtml(r.rec.sentBy || 'No sender') + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(mcDayLabel(r.day) + ' · ' + x.why) + '</span></span><span class="inv-row-end">' +
      (tone === 'left' && typeof mvOpen === 'function' ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMsgMcView" data-id="' + escHtml(r.id) + '">Open in Messages</button>' : '<span class="inv-badge inv-badge-neutral">Left out</span>') + '</span></div>';
  };
  if (o.skipped.length) h += '<div class="inv-panel inv-panel-flush" id="mcDoneSkipped"><div class="inv-panel-head"><span class="inv-panel-title">Left out <span class="inv-panel-count">' + o.skipped.length + '</span></span></div>' +
    o.skipped.map(function(x) { return row(x, 'skip'); }).join('') + '</div>';
  if (o.left.length) h += '<div class="inv-panel inv-panel-flush" id="mcDoneLeft"><div class="inv-panel-head"><span class="inv-panel-title">Left to look at <span class="inv-panel-count">' + o.left.length + '</span></span></div>' +
    uiMoreHtml('mc-left', o.left.map(function(x) { return row(x, 'left'); }), { noun: 'messages' }) + '</div>';
  if (!o.saved.length && !o.skipped.length && !o.left.length) h += uiBlankHtml({ kind: 'empty', title: 'Nothing saved' });
  return h;
}
