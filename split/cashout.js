/* ===== Cash paid out =====
   The supervisor's cash spent for the plant, as he sends it on WhatsApp (owner, 31 Oct 2026: "For Shyam's 1840 - he has
   given that as a message in whatsapp", then "Payout total"): a line each, a day before some, the amount at the end, a rule
   and the total under them:
     14/10/26/ HCL 200
     27/10/26/ JAR 200
     SABUN               300
     24/10/26/          140
     JAYNTO PAUL  800
     ----------------------------------
             ONLY       1840
   Read here, checked and stored (`S.cashOut`, the message kept whole in `S.cashPastes`), each line in a kind (`CASH_CATS`),
   and the whole counted in the week's payout total (payWeek), since the Saturday's cash pays it back to him with the wages:
   his weekly payment message lists it beside the payout and the snacks. On the bank's side the week's cash is then wages up
   to the payout, these costs up to what they came to, and drawings past both (bank.js, bankCostByMonth). */

var CASH_CATS = [
  { id: 'carriage', label: 'Carriage', re: /\b(hcl|acid|auto|transport|bhada|bhara|carriage|freight|tempo|thela)\b/i },
  { id: 'consumables', label: 'Consumables', re: /\b(sabun|soap|surf|jhadu|broom|jar|water|glove|gloves|cloth|kapda|tape|bucket|mug|paper)\b/i },
  { id: 'repair', label: 'Repairs', re: /\b(electric\w*|wire|rectif\w*|recitif\w*|mistri|mechanic|repair\w*|weld\w*|motor|pump|fitting)\b/i },
  { id: 'food', label: 'Food and tea', re: /\b(tea|chai|nasta|nashta|snack\w*|food|khana)\b/i },
  { id: 'service', label: 'Paid to a person' },
  { id: 'other', label: 'Other' }
];
function cashCatLabel(id) { var c = CASH_CATS.find(function(x) { return x.id === id; }); return c ? c.label : 'Other'; }
/* The kind a line's words read as. A line of two or more words with none the lists know, every one a word of letters, is
   somebody paid by name (JAYNTO PAUL): the owner says what for. Nothing written is Other. */
function cashCat(what) {
  var w = String(what || '').trim();
  if (!w) return 'other';
  for (var i = 0; i < CASH_CATS.length; i++) if (CASH_CATS[i].re && CASH_CATS[i].re.test(w)) return CASH_CATS[i].id;
  var words = w.split(/\s+/);
  if (words.length >= 2 && words.length <= 4 && words.every(function(x) { return /^[a-z.]+$/i.test(x); })) return 'service';
  return 'other';
}

var CASH_TOTAL_RE = /^(?:total|only|tot)\b\W*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:\/-|only)?$/i;
var CASH_LINE_RE = /^(?:(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?)?\s*(.*?)\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:\/-)?$/i;
/* Pure: the message's lines, its total, and what does not add up. `sentOn` is the day WhatsApp sent it, the week it is paid
   back in (the Saturday on or after it). */
function parseCashMessage(text, sentOn) {
  var out = { lines: [], total: null, sum: 0, issues: [], sentOn: sentOn || null };
  String(text || '').split('\n').forEach(function(raw, i) {
    var t = raw.replace(/\s+/g, ' ').trim();
    if (!t || /^[-–—_=*.\s]+$/.test(t)) return;
    var tm = t.match(CASH_TOTAL_RE);
    if (tm) { out.total = gstRound(parseFloat(tm[1].replace(/,/g, '')) || 0); return; }
    var m = t.match(CASH_LINE_RE);
    if (!m || !m[5]) { out.issues.push({ tone: 'warning', n: i + 1, text: '"' + t + '" has no amount: left out.' }); return; }
    var date = m[1] ? isoFromDmy(m[1], m[2], m[3]) : null;
    var what = m[4].replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').trim();
    var amount = gstRound(parseFloat(m[5].replace(/,/g, '')) || 0);
    var ln = { n: i + 1, raw: raw.trim(), date: date, what: what, amount: amount, cat: cashCat(what) };
    if (m[1] && !date) out.issues.push({ tone: 'warning', n: ln.n, text: '"' + m[1] + '/' + m[2] + '/' + m[3] + '" is not a day: the line is dated when the message was sent.' });
    if (!what) out.issues.push({ tone: 'warning', n: ln.n, text: formatCurrency(amount) + (date ? ' on ' + formatDate(date) : '') + ' says what it was for nowhere: type it in.' });
    out.lines.push(ln);
    out.sum = gstRound(out.sum + amount);
  });
  if (out.total != null && Math.abs(out.total - out.sum) >= 0.5)
    out.issues.push({ tone: 'danger', text: 'The lines add up to ' + formatCurrency(out.sum) + '; the message says ' + formatCurrency(out.total) + '.' });
  return out;
}
/* Whether a message is a cash account: two lines with an amount or more and a total that they add up to, and nothing a roll,
   stock or check-in reader takes. A total that does not add up is a cash account too (the review says so), as long as the
   lines all end in an amount. */
function cashLooksLike(text) {
  var k = typeof relayKind === 'function' ? relayKind(text) : 'other';
  if (k !== 'other' && k !== 'material') return false;
  // His weekly payment message (PAYMENT, NASTA, his own cash, TOTAL) sums the payout up; it is not cash spent.
  if (/\bpayment\b/i.test(text)) return false;
  var p = parseCashMessage(text);
  if (p.total == null || p.lines.length < 2) return false;
  if (p.issues.some(function(x) { return /has no amount/.test(x.text); })) return false;
  return Math.abs(p.total - p.sum) < 0.5 || p.lines.length >= 3;
}

function cashOut() { if (!Array.isArray(S.cashOut)) S.cashOut = []; return S.cashOut; }
function cashPastes() { if (!Array.isArray(S.cashPastes)) S.cashPastes = []; return S.cashPastes; }
/* A week's cash paid out, the entries the Saturday's payout pays back. */
function cashForWeek(weekStart) {
  return cashOut().filter(function(e) { return !e.voidedAt && e.week === weekStart; });
}
function cashWeekTotal(weekStart) {
  return gstRound(cashForWeek(weekStart).reduce(function(s, e) { return s + (Number(e.amount) || 0); }, 0));
}

/* ---------- The review ---------- */
var _cashReview = null;
function cashReviewOpen(text, sentOn) {
  var sent = sentOn || localDateStr();
  var p = parseCashMessage(text, sent);
  var hash = relayHash(text);
  var seen = cashPastes().find(function(x) { return x.hash === hash && !x.voidedAt; });
  _cashReview = { text: text, read: p, hash: hash, sentOn: sent, week: attWeekStartOf(sent), seen: seen || null };
  dialogOpen(cashReviewHtml(), { dismiss: true });
}
/* The review as a guided flow (UI pass 3 §26b): The message · Each line (what for, kind, day, amount) · The total; the preview the
   week's payout before and after the lines (payWeek().cashOut is counted in its total), a total the lines do not reach in red. */
function cashReviewModel() {
  var r = _cashReview, form = document.querySelector('[data-cash-review]');
  if (!r) return null;
  var p = r.read, sat = isoAddDays(r.week, 6);
  var q = function(k, i, d) { var el = form && form.querySelector('[data-cash-' + k + '="' + i + '"]'); return el ? String(el.value).trim() : d; };
  var typed = p.lines.map(function(ln, i) { return { what: q('what', i, ln.what || ''), amount: gstRound(parseFloat(q('amount', i, String(ln.amount))) || 0), n: ln.n }; });
  var live = typed.filter(function(ln) { return ln.amount > 0; }), blank = live.filter(function(ln) { return !ln.what; });
  var sum = gstRound(live.reduce(function(s, ln) { return s + ln.amount; }, 0));
  var lines = [], checks = [];
  if (r.seen) checks.push({ tone: 'danger', text: 'Saved on ' + formatDate(isoOf(new Date(r.seen.at))) + ': saving it again would count it twice.' });
  if (live.length) {
    lines.push(live.length + (live.length === 1 ? ' line' : ' lines') + ' of cash paid out, ' + escHtml(formatCurrency(sum)) + ', paid back with the payout of Sat ' + escHtml(stockShortDate(sat)));
    if (!r.seen && (typeof grdSeesWages !== 'function' || grdSeesWages())) {
      if (r.payoutBefore === undefined) { try { r.payoutBefore = payWeek(r.week).total; } catch (e) { r.payoutBefore = null; } }
      if (r.payoutBefore != null) lines.push('The week’s payout so far: ' + escHtml(formatCurrency(r.payoutBefore)) + ' → ' + escHtml(formatCurrency(gstRound(r.payoutBefore + sum))));
    }
  }
  if (p.total != null && Math.abs(p.total - sum) >= 0.5) checks.push({ tone: 'danger', text: 'The message says ' + formatCurrency(p.total) + '; the lines come to ' + formatCurrency(sum) + '.' });
  blank.forEach(function(ln) { checks.push({ tone: 'warning', text: 'Line ' + ln.n + ': say what it was for.' }); });
  return {
    steps: [
      { key: 'msg', title: 'Is this the message?', help: 'Sent ' + formatDate(r.sentOn) + '. Paid back with the payout of Sat ' + stockShortDate(sat) + ' (week ' + attPayWeekNumber(r.week) + ') and counted in its total.',
        guide: ['app-pay', ''], done: !r.seen, says: r.seen ? '' : 'Sent ' + formatDate(r.sentOn), body: '' },
      { key: 'lines', title: 'What was each line for?', help: 'A line with no amount is left out.', done: live.length > 0 && !blank.length,
        says: live.length && !blank.length ? live.length + (live.length === 1 ? ' line' : ' lines') : '', body: '' },
      { key: 'total', title: 'Does it add up?', done: live.length > 0 && (p.total == null || Math.abs(p.total - sum) < 0.5), says: live.length ? formatCurrency(sum) : '', body: '' }
    ],
    preview: { lines: lines, checks: checks, empty: 'Nothing with an amount yet.' }
  };
}
uiFlowDefine('cashReview', cashReviewModel);
function cashReviewHtml() {
  var r = _cashReview, p = r.read;
  var opts = function(sel) { return CASH_CATS.map(function(c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + escHtml(c.label) + '</option>'; }).join(''); };
  var rows = p.lines.map(function(ln, i) {
    return '<div class="inv-row inv-row-2" data-cash-line="' + i + '">' +
      '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap"><span class="inv-quote">' + escHtml(ln.raw) + '</span></span>' +
      '<span class="inv-fields">' +
      '<label class="inv-field"><span class="inv-field-label">For</span><input class="inv-input" data-cash-what="' + i + '" value="' + escHtml(ln.what) + '" autocomplete="off"' + (ln.what ? '' : ' aria-invalid="true"') + '></label>' +
      '<label class="inv-field"><span class="inv-field-label">Kind</span><select class="inv-select" data-cash-cat="' + i + '">' + opts(ln.cat) + '</select></label>' +
      '<label class="inv-field"><span class="inv-field-label">Day</span><input class="inv-input" type="date" data-cash-date="' + i + '" value="' + escHtml(ln.date || '') + '"></label>' +
      '<label class="inv-field"><span class="inv-field-label">Amount</span><input class="inv-input inv-input-num" type="number" step="0.01" min="0" inputmode="decimal" data-cash-amount="' + i + '" value="' + ln.amount + '"></label>' +
      '</span></span></div>';
  }).join('');
  var issues = p.issues.map(function(x) { return '<div class="inv-callout inv-callout-' + (x.tone === 'danger' ? 'danger' : 'warning') + '">' + (x.n ? 'Line ' + x.n + ': ' : '') + escHtml(x.text) + '</div>'; }).join('');
  var seen = r.seen ? '<div class="inv-callout inv-callout-danger" data-cash-seen>This message was saved on ' + formatDate(isoOf(new Date(r.seen.at))) + ': saving it again would count it twice.</div>' : '';
  var model = cashReviewModel(), body = {
    msg: seen + issues,
    lines: '<div class="inv-panel inv-panel-flush">' + rows + '</div>',
    total: '<div class="inv-panel inv-panel-flush">' + uiFactRowHtml({ label: 'Total', value: formatCurrency(p.sum), sub: p.total != null ? 'the message says ' + formatCurrency(p.total) : 'no total written', attrs: ' data-cash-sum' }) + '</div>'
  };
  // Drawn before the dialog is on the page: the lines are read as the message gave them.
  model.steps.forEach(function(s) { s.body = body[s.key]; });
  return '<div class="inv-dialog inv-dialog-wide" data-cash-review>' + dialogHeadHtml('Cash paid out') +
    uiFlowHtml('cashReview', model) +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invPayCashSave"' + (r.seen ? ' disabled' : '') + '>Save cash paid out</button></div></div>';
}
function cashReviewSave() {
  var r = _cashReview, form = document.querySelector('[data-cash-review]');
  if (!r || !form || r.seen) return;
  var lines = r.read.lines.map(function(ln, i) {
    var q = function(k) { var el = form.querySelector('[data-cash-' + k + '="' + i + '"]'); return el ? String(el.value).trim() : ''; };
    return { what: q('what'), cat: q('cat') || ln.cat, date: q('date') || null, amount: gstRound(parseFloat(q('amount')) || 0), n: ln.n };
  }).filter(function(ln) { return ln.amount > 0; });
  if (!lines.length) { showToast('Nothing with an amount to save', 'error'); return; }
  var blank = lines.find(function(ln) { return !ln.what; });
  if (blank) { showToast('Line ' + blank.n + ': say what it was for', 'error'); return; }
  if (!grdGate('payments', 'record cash paid out', cashReviewSave)) return;   // P1 (guard.js): money paid out
  var total = cashSaveCore(r, lines).total;
  saveState();
  var form0 = document.querySelector('[data-cash-review]'), sc = form0 && form0.closest('.inv-scrim-dialog');
  if (sc) { delete sc.dataset.typed; dialogCloseScrim(sc); }
  _cashReview = null;
  if (navPageOf() === 'pageStaff') renderAttendance();
  showToast('Cash paid out saved: ' + formatCurrency(total) + ', in the payout of Sat ' + stockShortDate(isoAddDays(r.week, 6)));
}
/* The review's save without its screen: the message kept whole, a line each in the week it is paid back in. The review and
   the confirmation screen (msgconfirm.js) write through here. `r` is the review's { text, hash, sentOn, week }; `lines` the
   lines with an amount, each saying what it was for. → { msgId, total }. */
function cashSaveCore(r, lines) {
  var by = typeof grdUserId === 'function' ? grdUserId() : null, at = Date.now();
  var msgId = 'CSHM-' + at.toString(36) + Math.random().toString(36).slice(2, 5);
  cashPastes().push({ id: msgId, text: r.text, hash: r.hash, sentOn: r.sentOn, week: r.week, at: at, by: by });
  lines.forEach(function(ln) {
    cashOut().push({ id: 'CSH-' + at.toString(36) + Math.random().toString(36).slice(2, 6), date: ln.date || r.sentOn, what: ln.what, amount: ln.amount,
      cat: ln.cat, week: r.week, msgId: msgId, at: at, by: by });
  });
  if (typeof mvSavedFrom === 'function') mvSavedFrom('cashPastes', cashPastes().slice(-1));
  return { msgId: msgId, total: gstRound(lines.reduce(function(s, ln) { return s + ln.amount; }, 0)) };
}
async function cashVoid(id) {
  var e = cashOut().find(function(x) { return x.id === id; });
  if (!e || e.voidedAt) return;
  if (!grdOk('voids') && !(await guardAsk('voids', 'void cash paid out'))) return;   // P1 (guard.js)
  var reason = await uiPrompt({ title: 'Void this line', body: 'It is kept on the record, not deleted.', label: 'Why is it void?',
    okLabel: 'Void it', required: true, requiredText: 'A void needs a reason.' });
  if (reason == null || e.voidedAt) return;
  reason = reason.trim();
  if (!reason) { showToast('A void needs a reason', 'error'); return; }
  e.voidedAt = Date.now();
  e.voidReason = reason;
  // A message whose every line is void can be pasted again.
  var m = cashPastes().find(function(x) { return x.id === e.msgId; });
  if (m && !cashOut().some(function(x) { return x.msgId === m.id && !x.voidedAt; })) m.voidedAt = Date.now();
  saveState();
  renderAttendance();
  showToast('Voided');
}

/* Pay's card: the week's cash paid out, a line each with its kind and day, folded to its total. */
function cashPayCardHtml(ws) {
  var list = cashForWeek(ws);
  if (!list.length) return '';
  var total = cashWeekTotal(ws), kinds = {};
  list.forEach(function(e) { kinds[e.cat] = (kinds[e.cat] || 0) + e.amount; });
  var sub = Object.keys(kinds).map(function(k) { return cashCatLabel(k) + ' ' + formatCurrency(kinds[k]); }).join(' · ');
  var rows = list.slice().sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); }).map(function(e) {
    return uiFactRowHtml({ label: escHtml(e.what), sub: cashCatLabel(e.cat) + ' · ' + stockShortDate(e.date), value: formatCurrency(e.amount),
      attrs: ' data-cash-row="' + escHtml(e.id) + '"',
      actions: '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invPayCashVoid" data-id="' + escHtml(e.id) + '">Void</button>' });
  }).join('');
  return '<div class="inv-panel inv-panel-flush" data-card="cashout"><div class="inv-panel-head"><span class="inv-panel-title">Cash paid out</span>' +
    '<span class="inv-panel-meta">' + formatCurrency(total) + '</span></div>' +
    '<div class="inv-note">Spent by the supervisor and paid back with the payout. ' + escHtml(sub) + '.</div>' + rows + '</div>';
}

function cashAction(action, btn) {
  switch (action) {
    case 'invPayCashSave': cashReviewSave(); return true;
    case 'invPayCashVoid': cashVoid(btn.dataset.id); return true;
  }
  return false;
}
