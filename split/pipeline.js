/* ===== OFFICE → PIPELINE (Direction B, step 5; P137) =====
   Owner, 1 Oct 2026 (docs/DIRECTION_B.md): where the billing is, as one line of stages, from the challan that came in to
   the money that has to come back:
     awaiting invoice → created → printed → dispatched → delivered → owed to us.
   Each stage is a count, an amount and a dot and a word for how long its oldest has waited, each read off the function its
   own screen uses: IM's open share (imLineOpen, imChallanOpenTotal) and the To-do's unbilled rule for its days; the
   Register's states (getInvState), its taxable and each invoice's own tone (invStateTone, read against Settings → Checks
   & alerts → Invoice states); and what Receivables say is owed (bankReceivables, finAgeing, figToneAge). Never a second
   copy of the arithmetic.
   A stage opens its list (beneath on the phone, beside on the desktop), drawn with the rows its own screen draws, and its
   action goes through the screen that owns it: an invoice from a client's challans by IM's route (its selection, then
   Create invoice), every invoice action through the Register's own selection and bulk bar (regJump with `select`), what
   is owed through Money → Receivables. Filed and cancelled are not stages: one is done, the other bills nothing.
   Nothing here writes to the book. */

var PIPE_STAGES = [['awaiting', 'Awaiting invoice'], ['created', 'Created'], ['printed', 'Printed'], ['dispatched', 'Dispatched'],
  ['delivered', 'Delivered'], ['owed', 'Owed to us']];
var _pipeStage = null;   // the stage open; the first draw sets the default (pipeDefaultStage), and the address keeps it (v=)

function pipeStageKey(k) { return PIPE_STAGES.some(function(s) { return s[0] === k; }) ? k : null; }
function pipeStageLabel(k) { var s = PIPE_STAGES.find(function(x) { return x[0] === k; }); return s ? s[1] : ''; }
function pipeDays(n) { return n + (n === 1 ? ' day' : ' days'); }
function pipeOldestWord(d) { return d == null ? '' : d === 0 ? 'since today' : 'oldest ' + pipeDays(d); }

/* The challans IM lists under Awaiting invoice (imIsBilled: not invoiced whole), oldest challan first, so the stage and
   IM's own count never disagree. */
function pipeAwaitingChallans() {
  return (S.incomingMaterial || []).filter(function(im) { return !imIsBilled(im); })
    .sort(function(a, b) { return String(a.challanDate || '').localeCompare(String(b.challanDate || '')) || (a.createdAt || 0) - (b.createdAt || 0); });
}
/* The invoices the Register lists under one state (an active invoice in it), oldest invoice first. */
function pipeInvoices(st) {
  return (S.invoices || []).filter(function(i) { return i.status === 'active' && getInvState(i) === st; })
    .sort(function(a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || (a.createdAt || 0) - (b.createdAt || 0); });
}

/* The six stages, in order: {key, label, n, amount, of (what the amount is), tone, word, items, open}. A stage is open
   (can be opened) when it holds something; Owed to us needs a bank statement to say anything (noBank). */
function pipeStages() {
  var today = localDateStr(), now = Date.now(), out = [];
  var add = function(key, o) {
    var s = Object.assign({ key: key, label: pipeStageLabel(key), n: 0, amount: 0, of: '', tone: 'neutral', word: '', items: [] }, o);
    s.open = s.n > 0;
    out.push(s);
  };

  // Awaiting invoice: amber at the To-do's unbilled days (Settings → Checks & alerts → To-do), red at twice them.
  var amberD = todoCfg().challanDays, redD = amberD * 2, ims = pipeAwaitingChallans();
  var ages = ims.map(function(im) { return im.challanDate ? Math.max(0, isoDaysBetween(im.challanDate, today)) : null; });
  var redN = ages.filter(function(a) { return a != null && a >= redD; }).length;
  var amberN = ages.filter(function(a) { return a != null && a >= amberD; }).length;
  add('awaiting', { n: ims.length, items: ims, of: 'to bill', amberD: amberD, redD: redD,
    amount: gstRound(ims.reduce(function(t, im) { return t + imChallanOpenTotal(im); }, 0)),
    tone: redN ? 'danger' : amberN ? 'warning' : 'neutral',
    word: redN ? redN + ' over ' + pipeDays(redD) : amberN ? amberN + ' over ' + pipeDays(amberD)
      : pipeOldestWord(ages.reduce(function(m, a) { return a != null && (m == null || a > m) ? a : m; }, null)) || 'no challan date' });

  // Created, printed, dispatched: each invoice's own tone for its days in the state; the words count the worst of them
  // against the days set for it. Delivered waits on its return: the earliest GSTR-1 due date, in the invoice's own words.
  var c = invStateCheckCfg();
  ['created', 'printed', 'dispatched', 'delivered'].forEach(function(st) {
    var list = pipeInvoices(st), tones = list.map(function(i) { return invStateTone(i, now); });
    var red = tones.filter(function(t) { return t === 'danger'; }).length, amber = tones.filter(function(t) { return t === 'warning'; }).length;
    var word;
    if (st === 'delivered') {
      var due = list.filter(function(i) { return invFileDue(i); }).sort(function(a, b) { return invFileDue(a) - invFileDue(b); });
      word = due.length ? invStateAgeText(due[0]) : 'no invoice date';
    } else {
      word = red ? red + ' over ' + pipeDays(c[st + 'Red']) : amber ? amber + ' over ' + pipeDays(c[st + 'Amber'])
        : pipeOldestWord(list.reduce(function(m, i) { return Math.max(m, invStateDays(i, now)); }, 0));
    }
    add(st, { n: list.length, items: list, of: 'taxable', amount: gstRound(sumTaxable(list)), tone: red ? 'danger' : amber ? 'warning' : 'neutral', word: word });
  });

  // Owed to us: what Receivables say, judged by the age of the oldest open invoice. Never red while a receipt is
  // unplaced: that money may be in already, and what is owed reads high (the owed90 rule's reason; Home says the same).
  if (!finHasBank()) add('owed', { noBank: true });
  else {
    var ctx = finCtx(), recv = ctx.recv(), owing = recv.filter(function(r) { return r.owed > 0.005; });
    var bands = finAgeing(recv), old90 = bands[3] ? bands[3].amount : 0, old60 = bands[2] ? bands[2].amount : 0;
    var oldest = owing.reduce(function(m, r) { return r.oldestDays != null && (m == null || r.oldestDays > m) ? r.oldestDays : m; }, null);
    var loose = bankLooseReceipts(ctx.cls, bankRecvFrom(ctx.rows)).length;
    var tone = figToneAge(oldest) || 'neutral';
    if (loose && tone === 'danger') tone = 'warning';
    var word = old90 > 0.005 ? finRs(old90) + ' over 90 days' : old60 > 0.005 ? finRs(old60) + ' over 60 days' : pipeOldestWord(oldest) || 'owed';
    if (loose) word += ' · ' + todoPlural(loose, 'receipt') + ' not placed';
    add('owed', { n: owing.length, items: owing, recv: recv, loose: loose, of: 'owed', tone: tone, word: word,
      amount: gstRound(recv.reduce(function(t, r) { return t + Math.max(0, r.owed); }, 0)) });
  }
  return out;
}

/* The stage that opens when none is chosen: the first holding a red, else the first holding anything. */
function pipeDefaultStage(stages) {
  var open = stages.filter(function(s) { return s.open; });
  var red = open.find(function(s) { return s.tone === 'danger'; });
  return red ? red.key : open.length ? open[0].key : null;
}

function renderPipeline() {
  var el = document.getElementById('pipelineContent');
  if (!el) return;
  var stages = pipeStages(), cur = stages.find(function(s) { return s.key === _pipeStage && s.open; });
  // A stage chosen that has emptied since (all of it marked on) gives way to the default.
  if (!cur) { _pipeStage = pipeDefaultStage(stages); cur = stages.find(function(s) { return s.key === _pipeStage; }) || null; }
  // The pipeline's own column keeps its place on a short desktop screen: the stage just tapped stays under the pointer.
  var rail = el.querySelector('.inv-pipe-rail'), railTop = rail ? rail.scrollTop : 0;
  el.innerHTML = '<div class="inv-toolbar"><button class="inv-btn inv-btn-primary" data-action="invCreateNew">Create invoice</button></div>' +
    '<div class="inv-pane-host inv-pipe-host" id="pipeHost"><div class="inv-pipe-rail">' + pipeRailHtml(stages) + '</div>' +
    '<div class="inv-pane-list" id="pipeList">' + pipeListHtml(cur) + '</div></div>';
  if (railTop) el.querySelector('.inv-pipe-rail').scrollTop = railTop;
}

/* ---------- The pipeline ---------- */
function pipeRailHtml(stages) {
  return '<div class="inv-panel inv-panel-flush" data-card="pipeline"><div class="inv-panel-head"><span class="inv-panel-title">Where the billing is</span></div>' +
    stages.map(pipeStageRowHtml).join('') +
    '<div class="inv-panel-body inv-note" data-pipe-note>Filed and cancelled invoices are not stages. Invoices count at their taxable, challans at what is left to bill.</div></div>';
}
function pipeStageRowHtml(s) {
  var node = '<span class="inv-row-lead inv-pipe-node" aria-hidden="true"><span class="inv-dot inv-dot-' + (s.open ? uiTone(s.tone) : 'neutral') + '"></span></span>';
  var title = '<span class="inv-row-title">' + escHtml(s.label) + (s.open ? ' <span class="inv-panel-count">' + s.n + '</span>' : '') + '</span>';
  if (s.noBank) {
    return '<div class="inv-row inv-row-2 inv-pipe-stage" data-pipe-stage="owed">' + node + '<span class="inv-row-main">' + title +
      '<span class="inv-row-meta inv-row-wrap">Needs a bank statement</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invHomeImportBank">Import statement</button></span></div>';
  }
  // A stage with nothing in it says so and does not open.
  if (!s.open) {
    return '<div class="inv-row inv-row-2 inv-pipe-stage" data-pipe-stage="' + s.key + '">' + node + '<span class="inv-row-main">' + title +
      '<span class="inv-row-meta">None</span></span></div>';
  }
  return '<button class="inv-row inv-row-2 inv-pipe-stage" data-action="invPipeStage" data-pipe-stage="' + s.key + '" aria-pressed="' + (s.key === _pipeStage) + '">' + node +
    '<span class="inv-row-main">' + title + '<span class="inv-row-meta inv-row-wrap">' + uiDot(s.tone, escHtml(s.word)) + '</span></span>' +
    '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num">' + formatCurrency(s.amount) + '</span><span class="inv-row-meta">' + s.of + '</span></span></span></button>';
}

/* ---------- The open stage's list ---------- */
function pipeListHtml(s) {
  if (!s) return '<div class="inv-panel"><div class="inv-empty">Nothing is on its way: no challan awaits an invoice, and every invoice is filed. Create invoice starts the next one.</div></div>';
  if (s.key === 'awaiting') return pipeAwaitingHtml(s);
  if (s.key === 'owed') return pipeOwedHtml(s);
  return pipeInvoicesHtml(s);
}
function pipeListHead(s, actionHtml) {
  return '<div class="inv-panel-head"><span class="inv-panel-title">' + escHtml(s.label) + ' <span class="inv-panel-count">' + s.n + '</span></span>' + (actionHtml || '') + '</div>';
}

/* Awaiting invoice: each client with its challans under it, oldest first. An invoice is one client's, so each client
   carries its own Create invoice (IM's route: that client's open lines selected, then Create invoice); a challan opens
   where it is kept, on IM. */
function pipeAwaitingHtml(s) {
  var today = localDateStr(), byClient = {}, order = [];
  s.items.forEach(function(im) {
    var k = String(im.clientId);
    if (!byClient[k]) { byClient[k] = []; order.push(k); }
    byClient[k].push(im);
  });
  var rows = order.map(function(k) {
    var list = byClient[k], name = list[0].clientName || 'No client';
    var age = list[0].challanDate ? Math.max(0, isoDaysBetween(list[0].challanDate, today)) : null;
    var tone = age == null ? 'neutral' : age >= s.redD ? 'danger' : age >= s.amberD ? 'warning' : 'neutral';
    var amt = gstRound(list.reduce(function(t, im) { return t + imChallanOpenTotal(im); }, 0));
    var client = '<div class="inv-row inv-row-2" data-pipe-client="' + escHtml(k) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(name) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + todoPlural(list.length, 'challan') + ' · ' + formatCurrency(amt) + ' to bill · ' +
      uiDot(tone, age == null ? 'no challan date' : age === 0 ? 'received today' : 'oldest ' + pipeDays(age)) + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPipeInvoice" data-client="' + escHtml(k) + '" ' +
      'aria-label="' + escHtml('Create invoice from ' + name + '’s ' + todoPlural(list.length, 'challan')) + '">Create invoice</button></span></div>';
    var kids = '<div class="inv-row-children">' + list.map(function(im) {
      return '<button class="inv-row inv-row-2" data-action="invPipeChallan" data-id="' + escHtml(im.id) + '" data-pipe-im="' + escHtml(im.id) + '">' +
        '<span class="inv-row-main">' + imRowMainHtml(im) + '</span>' + imRowEndHtml(im, true) + '</button>';
    }).join('') + '</div>';
    return { parts: [client, kids] };
  });
  return '<div class="inv-panel inv-panel-flush" data-pipe-list="awaiting">' +
    pipeListHead(s, '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPipeOpenIM">Open in Challans</button>') +
    uiMoreHtml('pipe-awaiting', rows, { noun: 'clients' }) + '</div>';
}

/* An invoice state: the Register's rows grouped by invoice date, oldest first, as its own list groups them. The stage's
   action opens the Register on that state with these invoices selected, where its bulk bar marks them. Delivered is filed
   a month at a time, the month its GSTR-1 is for: each month a row of its own carrying the month's action, its invoices
   under it (as Awaiting's clients carry theirs). */
var PIPE_BULK = {
  created: ['Open {n} in the Register', 'Opens the Register on Created with these selected: Printed or Dispatch marks them there.'],
  printed: ['Mark dispatched', 'Opens the Register with these selected: Dispatch there marks them.'],
  dispatched: ['Mark delivered', 'Opens the Register with these selected: Deliver there marks them.']
};
function pipeInvoicesHtml(s) {
  var rows = [], groups = {}, order = [], filing = s.key === 'delivered', now = Date.now();
  s.items.forEach(function(i) {
    var k = filing ? String(i.date || '').slice(0, 7) : (i.date || '');
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(i);
  });
  order.forEach(function(k) {
    var list = groups[k];
    if (!filing) {
      rows.push({ head: true, parts: [regGroupHeadHtml(k ? escHtml(formatDate(k)) : 'No date', list)] });
      list.forEach(function(i) { rows.push(regRowHtml(i)); });
      return;
    }
    var label = k ? imMonthLabel(k) : 'No date';
    rows.push({ parts: ['<div class="inv-row inv-row-2" data-pipe-month="' + escHtml(k) + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(label) + '</span>' +
      '<span class="inv-row-meta inv-row-wrap">' + todoPlural(list.length, 'invoice') + ' · ' + formatCurrency(gstRound(sumTaxable(list))) + ' taxable' +
      (invFileDue(list[0]) ? ' · ' + uiDot(invStateTone(list[0], now), escHtml(invStateAgeText(list[0]))) : '') + '</span></span>' +
      '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invPipeFile" data-month="' + escHtml(k) + '" ' +
      'aria-label="' + escHtml('File ' + label + ' in the Register') + '">File in the Register</button></span></div>',
      '<div class="inv-row-children">' + list.map(function(i) { return regRowHtml(i); }).join('') + '</div>'] });
  });
  var bulk = PIPE_BULK[s.key];
  var note = bulk ? bulk[1] : 'Each month opens in the Register with its invoices selected: File there marks them filed, once its GSTR-1 is in.';
  return '<div class="inv-panel inv-panel-flush" data-pipe-list="' + s.key + '">' +
    pipeListHead(s, bulk ? '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invPipeBulk" data-bulk="' + s.key + '">' + bulk[0].replace('{n}', s.n) + '</button>' : '') +
    '<div class="inv-panel-body inv-note">' + note + '</div>' +
    uiMoreHtml('pipe-' + s.key, rows, { noun: filing ? 'months' : 'invoices' }) + '</div>';
}

/* Owed to us: each client owing, largest first, as Money's overview lists its debtors; a client opens Receivables on it. */
function pipeOwedHtml(s) {
  var hist = bankPayHistory(s.recv);
  var rows = s.items.map(function(r) {
    var id = escHtml(String(r.client.id)), dtp = bankDaysToPay(r.client.id, hist);
    return '<button class="inv-row inv-row-2" data-action="invFinGo" data-tab="receipts" data-client="' + id + '" data-pipe-owed="' + id + '">' +
      '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(r.client.name) + '</span><span class="inv-row-meta">' + r.open.length + ' open' +
      (r.oldestDays != null ? ' · oldest ' + r.oldestDays + ' d' : '') +
      (dtp && dtp.median != null ? ' · pays in ' + figHtml(Math.round(dtp.median) + ' d', figTonePaysIn(dtp.median)) : '') + '</span></span>' +
      '<span class="inv-row-end inv-num">' + figHtml(formatCurrency(r.owed), figToneAge(r.oldestDays)) + '</span></button>';
  });
  return '<div class="inv-panel inv-panel-flush" data-pipe-list="owed">' +
    pipeListHead(s, '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts">Open Receivables</button>') +
    (s.loose ? '<div class="inv-panel-body inv-note">' + todoPlural(s.loose, 'receipt') + ' with no client ' + (s.loose === 1 ? 'is' : 'are') + ' not counted yet, so what is owed reads high. ' +
      '<button class="inv-btn inv-btn-link inv-btn-sm" data-action="invFinGo" data-tab="receipts" data-anchor="bankLoose">Place them</button></div>' : '') +
    uiMoreHtml('pipe-owed', rows, { noun: 'clients' }) + '</div>';
}

/* ---------- Doing ---------- */
/* A client's challans into a new invoice, the way IM does it: their open lines selected, then Create invoice
   (createInvoiceFromIM), a form already being typed on Create asked about first. */
function pipeInvoiceClient(clientId) {
  var ims = pipeAwaitingChallans().filter(function(im) { return String(im.clientId) === String(clientId); });
  if (!ims.length || !S.clients.some(function(c) { return String(c.id) === String(clientId); })) {
    showToast(ims.length ? 'That client is no longer in the book' : 'Nothing of theirs is waiting any more', 'warning');
    renderPipeline();
    return;
  }
  var lines = [];
  ims.forEach(function(im) { (im.items || []).forEach(function(it) { if (!it.invoiced) lines.push(it.id); }); });
  if (!lines.length) { showToast('These challans have no line to bill', 'warning'); return; }
  createDiscardOk().then(function(ok) {
    if (!ok) return;
    _imSelected = {};
    lines.forEach(function(id) { _imSelected[id] = true; });
    createInvoiceFromIM();
    createMarkBase();
  });
}
function pipeAction(action, btn) {
  switch (action) {
    case 'invPipeStage':
      _pipeStage = pipeStageKey(btn.dataset.pipeStage) || _pipeStage;
      renderPipeline();
      // Another stage is another list: it starts at its top (the keepScroll round a pressed button would hold the last one's).
      setTimeout(function() { var l = document.getElementById('pipeList'); if (l) l.scrollTop = 0; }, 0);
      return true;
    case 'invPipeChallan': imLocateChallan(btn.dataset.id); return true;
    case 'invPipeInvoice': pipeInvoiceClient(btn.dataset.client); return true;
    case 'invPipeOpenIM': imJumpClient(null); return true;
    case 'invPipeBulk': {
      var st = pipeStageKey(btn.dataset.bulk);
      if (st) regJump({ state: st, select: pipeInvoices(st).map(function(i) { return i.id; }) });
      return true;
    }
    case 'invPipeFile': {
      var ym = btn.dataset.month || '';
      regJump({ state: 'delivered', month: ym, select: pipeInvoices('delivered').filter(function(i) { return String(i.date || '').slice(0, 7) === ym; }).map(function(i) { return i.id; }) });
      return true;
    }
  }
  return false;
}
