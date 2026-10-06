/* ===== LEARNING FROM RESPONSES (docs/INTELLIGENCE_2.md, I5) =====
   Owner, 6 Oct 2026, the last step of refining the intelligence: how the owner answers the tasks the app raises tunes what it
   raises and in what order. Suggested, never silent: the app proposes, the owner applies with a tap (Settings' permission and
   PIN, guard.js), and every change can be put back.

   What is read:
   - a response, in the book (`S.todo.resp`, the last 400): a task's button followed (`go`), a move from it followed or added
     to the list (`go`, `list`), a snooze until the figures change (`snooze`) or for a week (`week`), with the days the task
     had been showing on this device (`age`);
   - when each task was first shown, and whether it was opened, on this device only (`sep_inv_todo_seen`, never in the book:
     what one screen showed is not a fact about the shop).
   What is suggested, per rule, over the last 90 days:
   - **raise** its threshold (twice it, within a cap), or **switch it off** where it has none: three or more of its tasks
     snoozed or left unopened for a fortnight, and none acted on;
   - **lead** with it (first in its tone, after what is firm): three or more acted on, typically within a day of showing.
   "Not now" keeps a suggestion away until the figures behind it change. */

var LEARN_SEEN_KEY = 'sep_inv_todo_seen';
var LEARN_DAYS = 90, LEARN_MIN = 3, LEARN_STALE_DAYS = 14, LEARN_RESP_MAX = 400;
/* The rules with a threshold the owner sets: [the setting, its unit, the most a suggestion raises it to]. */
var LEARN_THRESH = {
  challan: ['challanDays', 'days', 60], dispatch: ['dispatchDays', 'days', 30], paste: ['pasteDays', 'working days', 14],
  backup: ['backupDays', 'days', 60], prodPlatedUnbilled: ['prodPlatedDays', 'working days', 30]
};

function learnData() {
  var td = todoData();
  if (!Array.isArray(td.resp)) td.resp = [];
  if (!td.learn || typeof td.learn !== 'object' || Array.isArray(td.learn)) td.learn = {};
  var l = td.learn;
  if (!l.dismissed || typeof l.dismissed !== 'object') l.dismissed = {};
  if (!Array.isArray(l.applied)) l.applied = [];
  if (!l.lead || typeof l.lead !== 'object') l.lead = {};
  return td;
}

/* ---------- Seen, on this device ---------- */
function learnSeenRead() {
  try { var v = JSON.parse(localStorage.getItem(LEARN_SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
}
function learnSeenWrite(v) { try { localStorage.setItem(LEARN_SEEN_KEY, JSON.stringify(v)); } catch (e) { /* a per-device record only */ } }
/* The tasks drawn: a fold's members, each by its own key. Old entries go after twice the window. */
function learnSeen(tasks) {
  var seen = learnSeenRead(), today = localDateStr(), changed = false;
  (tasks || []).forEach(function(t) {
    (t && t.rule === 'fold' ? t.members || [] : [t]).forEach(function(m) {
      if (!m || !m.key || m.rule === 'learn') return;
      var e = seen[m.key];
      if (!e) { seen[m.key] = { f: today, l: today, r: m.rule }; changed = true; }
      else if (e.l !== today) { e.l = today; changed = true; }
    });
  });
  var cut = isoAddDays(today, -LEARN_DAYS * 2);
  Object.keys(seen).forEach(function(k) { if (!seen[k] || !seen[k].f || seen[k].f < cut) { delete seen[k]; changed = true; } });
  if (changed) learnSeenWrite(seen);
}
function learnOpened(t) {
  if (!t || !t.key || t.rule === 'fold' || t.rule === 'learn') return;
  var seen = learnSeenRead(), key = t.key;
  if (!seen[key]) seen[key] = { f: localDateStr(), r: t.rule };
  if (seen[key].o) return;
  seen[key].o = localDateStr();
  learnSeenWrite(seen);
}

/* ---------- Responses, in the book ---------- */
/* `t` an app task (a fold's members answer each for itself), `act` go | list | snooze | week. */
function learnRespond(t, act) {
  if (!t) return;
  var td = learnData(), seen = learnSeenRead(), today = localDateStr();
  (t.rule === 'fold' ? t.members || [] : [t]).forEach(function(m) {
    if (!m || !m.key || m.rule === 'learn') return;
    var s = seen[m.key];
    td.resp.push({ at: Date.now(), key: m.key, rule: m.rule, act: act, age: s && s.f ? Math.max(0, isoDaysBetween(s.f, today)) : null });
  });
  if (td.resp.length > LEARN_RESP_MAX) td.resp.splice(0, td.resp.length - LEARN_RESP_MAX);
  saveState();
}
function learnRespondKey(key, act) {
  var t = todoAppFind(key);
  if (t) learnRespond(t, act);
}

/* ---------- What it adds up to ---------- */
function learnStats() {
  var td = learnData(), from = Date.now() - LEARN_DAYS * 864e5, today = localDateStr(), out = {};
  var r = function(rule) { return out[rule] || (out[rule] = { go: 0, list: 0, snooze: 0, stale: 0, ages: [], answered: {}, once: {} }); };
  // Evidence a change was applied on is spent: a rule counts only what came after its latest change still in force, else
  // the same snoozes would ask to raise it again, and again.
  var since = {};
  td.learn.applied.forEach(function(a) { if (a && !a.undoneAt && a.rule) since[a.rule] = Math.max(since[a.rule] || 0, a.at || 0); });
  // A fold answered is one decision for its members: counted once (same act, same moment), each member still answered.
  td.resp.forEach(function(x) {
    if (!x || x.at < from || !x.rule || x.at <= (since[x.rule] || 0)) return;
    var s = r(x.rule);
    s.answered[x.key] = true;
    var k = x.act + '@' + x.at;
    if (s.once[k]) return;
    s.once[k] = true;
    if (x.act === 'go') { s.go++; if (x.age != null) s.ages.push(x.age); }
    else if (x.act === 'list') s.list++;
    else if (x.act === 'snooze' || x.act === 'week') s.snooze++;
  });
  var seen = learnSeenRead(), first = isoAddDays(today, -LEARN_DAYS);
  Object.keys(seen).forEach(function(k) {
    var e = seen[k];
    // On screen a fortnight or more without being opened or answered: a task that cleared itself sooner was not ignored.
    if (!e || !e.r || e.o || e.f < first || isoDaysBetween(e.f, e.l || e.f) < LEARN_STALE_DAYS) return;
    if (since[e.r] && e.f <= isoOf(new Date(since[e.r]))) return;
    var s = r(e.r);
    if (!s.answered[k]) s.stale++;
  });
  return out;
}
function learnRuleLabel(rule) {
  var x = TODO_RULES.find(function(r) { return r[0] === rule; });
  return x ? x[1] : rule;
}
function learnSuggestions() {
  if (typeof grdOn === 'function' && grdOn() && !grdCan('settings')) return [];
  var st = learnStats(), cfg = todoCfg(), td = learnData(), out = [];
  Object.keys(st).forEach(function(rule) {
    if (rule === 'learn' || rule === 'fold' || !TODO_RULES.some(function(r) { return r[0] === rule; }) || !cfg[rule]) return;
    var s = st[rule], label = learnRuleLabel(rule), acted = s.go + s.list, quiet = s.snooze + s.stale;
    var sig = [s.go, s.list, s.snooze, s.stale].join('|');
    var why = [s.snooze ? todoPlural(s.snooze, 'snooze') : '', s.stale ? todoPlural(s.stale, 'task') + ' left unopened for ' + LEARN_STALE_DAYS + ' days or more' : '']
      .filter(Boolean).join(' and ');
    if (quiet >= LEARN_MIN && !acted) {
      var th = LEARN_THRESH[rule];
      if (th) {
        var cur = cfg[th[0]], to = Math.min(th[2], cur * 2);
        if (to > cur) out.push({ key: 'raise:' + rule, kind: 'raise', rule: rule, field: th[0], from: cur, to: to, sig: sig,
          title: 'Raise ' + label.charAt(0).toLowerCase() + label.slice(1) + ' to ' + to + ' ' + th[1],
          say: why + ' in ' + LEARN_DAYS + ' days, none acted on. Now ' + cur + ' ' + th[1] + '.' });
        return;
      }
      out.push({ key: 'off:' + rule, kind: 'off', rule: rule, sig: sig, title: 'Switch off: ' + label.charAt(0).toLowerCase() + label.slice(1),
        say: why + ' in ' + LEARN_DAYS + ' days, none acted on.' });
      return;
    }
    var med = s.ages.length ? numMedian(s.ages) : null;
    if (s.go >= LEARN_MIN && med != null && med <= 1 && !td.learn.lead[rule] && !quiet) {
      out.push({ key: 'lead:' + rule, kind: 'lead', rule: rule, sig: sig, title: 'Lead with: ' + label.charAt(0).toLowerCase() + label.slice(1),
        say: todoPlural(s.go, 'task') + ' acted on in ' + LEARN_DAYS + ' days, ' + (med === 0 ? 'the day they showed' : 'within a day') + '. It would come first in its tone, after what is firm.' });
    }
  });
  return out.filter(function(x) { return td.learn.dismissed[x.key] !== x.sig; });
}

/* ---------- Applying, and putting back ---------- */
function learnApply(key) {
  var sg = learnSuggestions().find(function(x) { return x.key === key; });
  if (!sg) { showToast('That suggestion has changed', 'warning'); todoRefreshViews(); return; }
  if (typeof grdGate === 'function' && !grdGate('settings', 'change a To-do check', function() { learnApply(key); })) return;
  var td = learnData();
  if (!S.todoCheck || typeof S.todoCheck !== 'object') S.todoCheck = {};
  if (sg.kind === 'raise') S.todoCheck[sg.field] = sg.to;
  else if (sg.kind === 'off') S.todoCheck[sg.rule] = false;
  else if (sg.kind === 'lead') td.learn.lead[sg.rule] = true;
  td.learn.applied.push({ at: Date.now(), key: sg.key, kind: sg.kind, rule: sg.rule, field: sg.field || null, from: sg.from == null ? null : sg.from, to: sg.to == null ? null : sg.to });
  saveState();
  todoRefreshViews();
  showToast(sg.kind === 'raise' ? 'Raised to ' + sg.to : sg.kind === 'off' ? 'Switched off' : 'It leads its tone now');
}
function learnUndo(i) {
  var td = learnData(), a = td.learn.applied[i];
  if (!a || a.undoneAt) return;
  if (typeof grdGate === 'function' && !grdGate('settings', 'change a To-do check', function() { learnUndo(i); })) return;
  if (!S.todoCheck || typeof S.todoCheck !== 'object') S.todoCheck = {};
  if (a.kind === 'raise' && a.field) S.todoCheck[a.field] = a.from;
  else if (a.kind === 'off') S.todoCheck[a.rule] = true;
  else if (a.kind === 'lead') delete td.learn.lead[a.rule];
  a.undoneAt = Date.now();
  saveState();
  todoRefreshViews();
  showToast('Put back');
}
function learnDismiss(key) {
  var sg = learnSuggestions().find(function(x) { return x.key === key; });
  if (!sg) return;
  learnData().learn.dismissed[key] = sg.sig;
  saveState();
  todoRefreshViews();
}

/* ---------- Drawing ---------- */
/* The To-do's panel: what is suggested, then what was applied (the last five still in force), each with its way back. */
function learnPanelHtml() {
  var sug = [], td = learnData();
  try { sug = learnSuggestions(); } catch (e) { sug = []; }
  var applied = td.learn.applied.map(function(a, i) { return { a: a, i: i }; }).filter(function(x) { return !x.a.undoneAt; }).slice(-5).reverse();
  if (!sug.length && !applied.length) return '';
  if (typeof grdOn === 'function' && grdOn() && !grdCan('settings')) return '';
  var h = '<div class="inv-panel inv-panel-flush inv-panels-wide" data-todo-sec="learn" id="todoLearn"><div class="inv-panel-head"><span class="inv-panel-title">Learnt from your answers' +
    (sug.length ? ' <span class="inv-panel-count">' + sug.length + '</span>' : '') + '</span><span class="inv-badge">Suggested</span></div>';
  sug.forEach(function(x) {
    h += '<div class="inv-row inv-row-2 inv-row-flow" data-learn="' + escHtml(x.key) + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(x.title) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + escHtml(x.say) + '</span></span><span class="inv-row-end inv-row-actions">' +
      '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invLearnApply" data-key="' + escHtml(x.key) + '">Apply</button>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invLearnDismiss" data-key="' + escHtml(x.key) + '">Not now</button></span></div>';
  });
  if (applied.length) {
    h += '<div class="inv-row-group"><span>Applied</span><span class="inv-num">' + applied.length + '</span></div>';
    applied.forEach(function(x) {
      var a = x.a, label = learnRuleLabel(a.rule), what = a.kind === 'raise' ? 'Raised from ' + a.from + ' to ' + a.to : a.kind === 'off' ? 'Switched off' : 'Leads its tone';
      h += '<div class="inv-row inv-row-2 inv-row-flow" data-learn-applied="' + x.i + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(label) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(what + ' · ' + formatTimestamp(a.at)) + '</span></span><span class="inv-row-end inv-row-actions">' +
        '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invLearnUndo" data-i="' + x.i + '">Put back</button></span></div>';
    });
  }
  return h + '</div>';
}

/* One task on the To-do while anything is suggested: the owner's (a setting is changed by applying one). */
TODO_RULES.push(['learn', 'Suggestions learnt from how you answer the tasks']);
TODO_CHECK_DEFAULTS.learn = true;
TODO_RULE_NEED.learn = 'owner';
TODO_RULE_FNS.learn = function() {
  var sug = learnSuggestions();
  if (!sug.length) return [];
  return [{ key: 'learn', rule: 'learn', tone: 'info', title: todoPlural(sug.length, 'suggestion') + ' from how you answer the tasks',
    sub: sug.slice(0, 2).map(function(x) { return x.title; }).join(' · ') + (sug.length > 2 ? ' · and ' + (sug.length - 2) + ' more' : ''),
    why: 'To-do · learnt over ' + LEARN_DAYS + ' days', facts: sug.map(function(x) { return [x.title, x.say]; }),
    clears: 'Clears itself when each is applied or put off with Not now.', go: { kind: 'todoLearn' }, goLabel: 'See them',
    sig: sug.map(function(x) { return x.key + '=' + x.sig; }).join(';') }];
};

function learnAction(action, btn) {
  switch (action) {
    case 'invLearnApply': learnApply(btn.dataset.key); return true;
    case 'invLearnDismiss': learnDismiss(btn.dataset.key); return true;
    case 'invLearnUndo': learnUndo(parseInt(btn.dataset.i, 10)); return true;
  }
  return false;
}
