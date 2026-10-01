/* ===== SEARCH, KEYS AND NEW WINDOWS =====
   Direction B, step 6 (P139): UX overhaul 2's steps 3 to 5 on B's shell. Owner, 28 Sep 2026: "search now; a chatbot
   later", the index built so that the chatbot can find what to answer from.

   THE INDEX (srchIndex) is a plain list of {kind, id, title, sub, text, go}: every invoice, challan, client, part, worker,
   stock line, bank row, quotation and credit note, and every screen and action by its name and its B name. `go` is the
   jump the entry makes: an address (nav.js), a To-do jump (todoGo), a Settings section, or a record kind srchGo knows.
   It is built when search first needs it and kept until the book changes (a save here moves _bookWrites; another
   window's book, an import or a pull is a new S), never on a keystroke. It never leaves the device.

   MATCHING (srchQuery): every part of the query must match. A number matches whole: 834 finds challan 834 and invoice
   00834, never 8341 (leading zeros ignored, as imChallanNoKey does). An amount matches to the paisa: 5902.12, 5,902.12,
   ₹5,902.12. A date matches its day: 21/09/2026, 2026-09-21, 21 Sep. A word matches the start of a word, case and
   punctuation folded (rateKey); a number written with its punctuation (SEP/2026-27/00834, DA1/00877) matches as one.
   Results come grouped by kind, screens first, five a kind with Show all.

   THE PALETTE (searchOpen) is a layer: back and Esc close it, and it takes no address. A full-height sheet on the phone,
   centred on the desktop. The arrow keys move the cursor (aria-selected, the suggestion lists' pattern), Enter opens.
   Before anything is typed: Recent (the last eight opened from here, kept on the device), then Go to.

   KEYS: Ctrl K or / searches, N a new invoice, C a new challan, G then a letter jumps, J and K walk the rows of Invoices
   and Challans (Enter opens one), Esc shuts the desktop's pane, ? lists them. None fires while a field has focus or a
   layer is open (nav.js's rule for Backspace); Ctrl K, which types nothing, also works from the field the app focused
   on arriving at a screen, while it is still empty.

   NEW WINDOWS (desktop): Ctrl+click or a middle click on a sidebar item, a view tab or a list row opens that place's
   address in a new window, and the top bar's New window button opens the place on screen. The version guard (P93) makes
   two windows on one book safe. */

var SRCH_RECENT_KEY = 'sep_inv_search_recent';
var SRCH_RECENT_N = 8;
var SRCH_PER_KIND = 5;     // a kind shows its first five; Show all lists the rest
var SRCH_ALL_MAX = 200;    // a kind shown whole draws this many at most, and says how many more
var SRCH_G_MS = 1500;      // G, then the letter within this

/* The kinds, in the order their groups are listed: kind, the group's name, one of them, and whether a title is an
   identifier (drawn mono, DR-4). */
var SRCH_KINDS = [
  ['screen', 'Screens', 'Screen', false], ['invoice', 'Invoices', 'Invoice', true], ['challan', 'Challans', 'Challan', true],
  ['client', 'Clients', 'Client', false], ['part', 'Parts', 'Part', true], ['worker', 'Workers', 'Worker', false],
  ['stock', 'Stock lines', 'Stock line', false], ['bank', 'Bank rows', 'Bank row', false],
  ['quote', 'Quotations', 'Quotation', true], ['cn', 'Credit notes', 'Credit note', true]
];
var _srchKindMap = null;
function srchKindOf(k) {
  if (!_srchKindMap) {
    _srchKindMap = {};
    SRCH_KINDS.forEach(function(x) { _srchKindMap[x[0]] = { kind: x[0], group: x[1], one: x[2], ident: x[3] }; });
  }
  return _srchKindMap[k] || { kind: k, group: k, one: k, ident: false };
}
/* Words a record answers to besides its own: "ch 834" is challan 834. */
var SRCH_KIND_WORDS = { invoice: 'invoice inv', challan: 'challan ch', client: 'client customer', part: 'part item',
  worker: 'worker', stock: 'stock', bank: 'bank', quote: 'quotation quote qtn', cn: 'credit note cn' };

/* The workspaces (Direction B) and the screens Go to lists for each, first one first: G then the letter opens the first
   that this build holds (Office's Pipeline and Floor's Day arrive with B5; until then Challans and People). */
var SRCH_SPACES = [
  ['t', 'Today', ['needs', 'pulse', 'todo']],
  ['o', 'Office', ['pipeline', 'im', 'register', 'clients']],
  ['f', 'Floor', ['floor', 'people', 'production', 'stock', 'power']],
  ['m', 'Money', ['money']],
  ['i', 'Insights', ['stats', 'reports', 'history']]
];
var SRCH_G_MORE = { r: ['register'], c: ['im'] };

/* ---------- Folding ---------- */
/* An identifier folded: case, spaces and punctuation out, each run of digits without its leading zeros, so 00834 is 834
   and 0877/26-27 is 8772627 (imChallanNoKey's rule, then rateKey's). */
function srchIdKey(s) {
  return rateKey(String(s == null ? '' : s).replace(/(^|[^0-9])0+(?=[0-9])/g, '$1'));
}
/* The words of a text, each folded as an identifier. */
function srchWordsOf(s) {
  return String(s == null ? '' : s).split(/[^A-Za-z0-9]+/).map(srchIdKey).filter(Boolean);
}
/* Every run of digits, without its leading zeros. */
function srchNumsOf(s) {
  return (String(s == null ? '' : s).match(/\d+/g) || []).map(function(n) { return n.replace(/^0+(?=\d)/, ''); });
}
/* A figure as whole paise, the key an amount is matched on (never a sum: HR-8 is about money computed). */
function srchPaise(v) {
  var n = Number(v);
  return isFinite(n) && n !== 0 ? String(Math.round(Math.abs(gstRound(n)) * 100)) : '';
}
function srchPad(n) { return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(14, '0'); }

/* ---------- The index ---------- */
/* Every screen and action, by its B name first and by the names it had (IM is Challans, Register is Invoices, Staff is
   People): [id, title, where, also, go]. A page this build does not hold is left out. */
function srchScreens() {
  var at = function(tab, v) { return { kind: 'place', loc: { tab: tab, v: v || '', id: '' } }; };
  var act = function(a) { return { kind: 'act', act: a }; };
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  var lastMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  var list = [
    ['needs', 'Needs you', 'Today', 'home today dashboard inputs', at('pageHome', 'needs')],
    ['pulse', 'Pulse', 'Today', 'home questions what to do widgets', at('pageHome', 'pulse')],
    ['todo', 'To-do', 'Today', 'tasks todo my list needs you', at('pageTodo', 'open')],
    ['todo-done', 'To-do, done', 'Today', 'tasks ticked done', at('pageTodo', 'done')],
    ['pipeline', 'Pipeline', 'Office', 'awaiting created printed dispatched delivered owed stages', at('pagePipeline')],
    ['im', 'Challans', 'Office · was IM', 'im incoming material awaiting invoice', at('pageIM', 'awaiting')],
    ['im-invoiced', 'Challans, invoiced', 'Office · was IM', 'im incoming material billed', at('pageIM', 'invoiced')],
    ['register', 'Invoices', 'Office · was Register', 'register invoice list sales', at('pageRegister')],
    ['clients', 'Clients', 'Office', 'customers parties', at('pageClients', 'clients')],
    ['items', 'Items', 'Office › Clients', 'parts items master part numbers weights', at('pageClients', 'items')],
    ['performance', 'Performance', 'Office › Clients', 'client performance materials worked by the hour stopped parts', at('pageClients', 'performance')],
    ['quotes', 'Quotations', 'Office › Clients', 'quotation quote qtn rates', at('pageClients', 'quotes')],
    ['cn-list', 'Credit notes', 'Office › Invoices', 'credit note cn rebate', { kind: 'cnList' }],
    ['audit', 'Number audit', 'Office › Invoices', 'void voided gaps serial numbers missing', { kind: 'audit' }],
    ['floor', 'Day', 'Floor', 'floor lines heads crew', at('pageFloor')],
    ['people', 'People', 'Floor · was Staff', 'staff attendance overview', at('pageStaff', 'overview')],
    ['att-day', 'Attendance', 'Floor › People', 'day marks present absent', at('pageStaff', 'day')],
    ['att-week', 'Week', 'Floor › People', 'attendance week grid', at('pageStaff', 'week')],
    ['pay', 'Pay', 'Floor › People', 'payroll wages salary payout due advance', at('pageStaff', 'pay')],
    ['areas', 'Areas', 'Floor › People', 'staffing complement needed today extra hours', at('pageStaff', 'areas')],
    ['roster', 'Roster', 'Floor › People', 'workers staff list hands', at('pageStaff', 'roster')],
    ['production', 'Production', 'Floor', 'plated pickled register output', at('pageProduction', 'overview')],
    ['prod-plant', 'In plant', 'Floor › Production', 'material in plant waiting pickled plated', at('pageProduction', 'plant')],
    ['prod-lines', 'Lines', 'Floor › Production', 'vat a1 a2 barrel line output', at('pageProduction', 'lines')],
    ['prod-entries', 'Production entries', 'Floor › Production', 'entries record', at('pageProduction', 'entries')],
    ['stock', 'Stock', 'Floor', 'chemicals overview days left', at('pageStock', 'overview')],
    ['stock-lines', 'Stock lines', 'Floor › Stock', 'chemicals levels', at('pageStock', 'list')],
    ['reorder', 'Reorder list', 'Floor › Stock', 'order purchase buy', at('pageStock', 'reorder')],
    ['power', 'Power', 'Floor', 'power cuts electricity outage', at('pagePower', 'overview')],
    ['power-cuts', 'Power cuts', 'Floor › Power', 'cuts outages damage', at('pagePower', 'cuts')],
    ['power-load', 'Load & bills', 'Floor › Power', 'load kva sanctioned connection electricity bills', at('pagePower', 'load')],
    ['power-case', 'Power case', 'Floor › Power', 'case for backup generator inverter tsuisl payback', at('pagePower', 'case')],
    ['money', 'Money', 'Money · was Finance', 'finance cash overview balance', at('pageFinance', 'overview')],
    ['receivables', 'Receivables', 'Money', 'owed debtors receipts outstanding dues', at('pageFinance', 'receipts')],
    ['payments', 'Payments', 'Money', 'paid out expenses suppliers', at('pageFinance', 'payments')],
    ['bank', 'Bank', 'Money', 'statement ledger import', at('pageFinance', 'bank')],
    ['bills', 'Bills & notes', 'Money', 'electricity bills credit notes', at('pageFinance', 'bills')],
    ['gst', 'GST', 'Money', 'gstr tax return output', at('pageFinance', 'gst')],
    ['stats', 'Stats', 'Insights', 'statistics overview realisation tonnage', at('pageStats', 'overview')],
    ['stats-clients', 'Contribution by client', 'Insights › Stats', 'stats clients realisation concentration revenue', at('pageStats', 'clients')],
    ['live-cost', 'Live cost', 'Insights › Stats', 'cost per kg labour chemicals zinc power', at('pageStats', 'cost')],
    ['stats-billing', 'Billing', 'Insights › Stats', 'invoice states unbilled dispatch', at('pageStats', 'billing')],
    ['trends', 'Trends', 'Insights › Stats', 'trend chart top items', at('pageStats', 'trends')],
    ['reports', 'Reports', 'Insights', 'report daily weekly monthly quarterly yearly print', at('pageReports')],
    ['history', 'History', 'Insights', 'activity log audit trail events', at('pageHistory')],
    // Actions: each opens its place on the job.
    ['new-invoice', 'New invoice', 'Add', 'create invoice', act('invoice')],
    ['new-challan', 'New challan', 'Add', 'add challan incoming material', act('challan')],
    ['new-quote', 'New quotation', 'Add', 'quote qtn', act('quote')],
    ['add-client', 'Add client', 'Add', 'new client customer', act('client')],
    ['add-item', 'Add item', 'Add', 'new part', act('item')],
    ['add-worker', 'Add worker', 'Add', 'new worker hand staff', act('worker')],
    ['add-task', 'Add task', 'Add', 'new task to-do', act('task')],
    ['stock-entry', 'Stock entry', 'Add', 'enter by hand count received used charged', act('stock')],
    ['paste', 'Paste message', 'Add', 'whatsapp roll stock pickling production power cut', act('paste')],
    ['add-bill', 'Add a bill', 'Add', 'electricity bill power bill', { kind: 'bills', month: lastMonth }],
    ['settings', 'Settings', 'Settings', 'preferences', { kind: 'settings' }]
  ];
  // Every Settings section by its own title, under its group, so a new section is found without a line here.
  if (typeof SETTINGS_GROUPS !== 'undefined') SETTINGS_GROUPS.forEach(function(g) {
    g.secs.forEach(function(k) {
      var s = SETTINGS_SECS[k];
      if (s) list.push(['set-' + k, s.title, 'Settings › ' + g.label, 'settings ' + g.label, { kind: 'settings', sec: k }]);
    });
  });
  return list.filter(function(x) { return x[4].kind !== 'place' || isPageId(x[4].loc.tab); });
}

/* A screen's entry: the index's, and what Go to draws before the index is built. */
function srchScreenEntry(x) {
  return { kind: 'screen', id: x[0], title: x[1], sub: x[2], text: x[1] + ' (' + x[2] + '): ' + x[3], go: x[4] };
}

var _srchCache = null;    // {s, w, list, keys, byKey, ms, parts}

/* The list, as a chatbot would read it. */
function srchIndex() { return srchData().list; }
/* Whether the index on hand is the book's as it stands. */
function srchFresh() { return !!(_srchCache && _srchCache.s === S && _srchCache.w === _bookWrites); }

/* The list and its match keys, built once per book. One kind failing to read is left out, never the whole. The time each
   kind took is kept (parts), for the spec to report. */
function srchData() {
  if (srchFresh()) return _srchCache;
  var t0 = performance.now(), list = [], keys = [], byKey = {}, parts = {}, memo = {};
  var add = function(e, m) {
    byKey[e.kind + '|' + e.id] = list.length;
    list.push(e);
    keys.push(srchKeys(e.kind, m, memo));
  };
  var each = function(what, fn) {
    var t = performance.now();
    try { fn(); } catch (err) { console.error('search index, ' + what, err); }
    parts[what] = performance.now() - t;
  };
  each('screens', function() {
    srchScreens().forEach(function(x, i) {
      add(srchScreenEntry(x), { title: x[1], words: [x[1], x[2], x[3]], rank: srchPad(9999 - i) });
    });
  });
  each('invoices', function() {
    (S.invoices || []).forEach(function(inv) {
      var num = inv.displayNumber || inv.invoiceNumber || '', state = invStateWord(inv);
      var serial = srchNumsOf(num).pop() || srchNumsOf(inv.invoiceNumber).pop() || '';
      add({ kind: 'invoice', id: String(inv.id), title: num,
        sub: [formatDate(inv.date), inv.clientName, formatCurrency(inv.grandTotal), state].filter(Boolean).join(' · '),
        text: 'Invoice ' + num + ' to ' + (inv.clientName || '') + ', dated ' + formatDate(inv.date) + ': taxable ' + formatCurrency(inv.taxableValue) +
          ', total ' + formatCurrency(inv.grandTotal) + (inv.challanNo ? '; challans ' + inv.challanNo : '') + (inv.poNumber ? '; P.O. ' + inv.poNumber : '') + '; ' + state + '.',
        go: { kind: 'invoice', id: String(inv.id) } },
        { title: num, words: [inv.clientName, inv.poNumber], ids: [num, inv.poNumber, inv.challanNo], nums: [inv.challanNo, inv.poNumber],
          primary: [serial], amounts: [inv.taxableValue, inv.grandTotal], dates: [inv.date], rank: (inv.date || '') + srchPad(inv.createdAt) });
    });
  });
  each('challans', function() {
    (S.incomingMaterial || []).forEach(function(im) {
      var lines = im.items || [], st = (IM_STATUS_UI[getIMStatus(im)] || {}).word || '', total = gstRound(imChallanTotal(im));
      var parts = lines.map(function(l) { return [l.partNumber, l.desc].filter(Boolean).join(' '); });
      add({ kind: 'challan', id: String(im.id), title: imChallanLabel(im),
        sub: [formatDate(im.challanDate), im.clientName, formatCurrency(total), st].filter(Boolean).join(' · '),
        text: 'Challan ' + (im.challanNo || '(no number)') + ' from ' + (im.clientName || '') + ', dated ' + formatDate(im.challanDate) + ': ' + parts.join('; ') + '; ' + formatCurrency(total) + '; ' + st + '.',
        go: { kind: 'challan', id: String(im.id) } },
        { title: imChallanLabel(im), words: [im.clientName].concat(parts), ids: [im.challanNo].concat(lines.map(function(l) { return l.partNumber; })),
          primary: [im.challanNo], amounts: [total], dates: [im.challanDate], rank: (im.challanDate || '') + srchPad(im.createdAt) });
    });
  });
  each('clients', function() {
    (S.clients || []).forEach(function(c) {
      var phones = [c.mobile, c.phone].filter(Boolean), off = c.isActive === false;
      add({ kind: 'client', id: String(c.id), title: c.name || '',
        sub: [c.gstin, phones.join(', '), off ? 'Inactive' : ''].filter(Boolean).join(' · ') || 'Client',
        text: 'Client ' + (c.name || '') + (c.gstin ? ', GSTIN ' + c.gstin : '') + (phones.length ? ', phone ' + phones.join(', ') : '') + (off ? ', inactive' : '') + '.',
        go: { kind: 'client', id: String(c.id) } },
        { title: c.name, words: [c.name], ids: [c.gstin].concat(phones), nums: phones, rank: off ? '0' : '1' });
    });
  });
  each('parts', function() {
    (S.items || []).forEach(function(p) {
      add({ kind: 'part', id: String(p.id), title: p.partNumber || '',
        sub: [p.desc, p.gauge, p.unit].filter(Boolean).join(' · ') || 'Part',
        text: 'Part ' + (p.partNumber || '') + (p.desc ? ', ' + p.desc : '') + (p.gauge ? ', gauge ' + p.gauge : '') + (p.unit ? ', billed by ' + p.unit : '') + '.',
        go: { kind: 'part', id: String(p.id) } },
        { title: p.partNumber, words: [p.partNumber, p.desc, p.gauge], ids: [p.partNumber], primary: [p.partNumber], rank: '' });
    });
  });
  each('workers', function() {
    (S.staff || []).forEach(function(w) {
      var off = w.active === false, cls = compClass(w.comp);
      add({ kind: 'worker', id: String(w.id), title: w.name || '',
        sub: [cls ? cls.label : '', areaLabel(w.area), off ? 'Inactive' : ''].filter(Boolean).join(' · '),
        text: 'Worker ' + (w.name || '') + ', ' + (cls ? cls.label : '') + ', ' + areaLabel(w.area) + (off ? ', inactive' : '') + '.',
        go: { kind: 'worker', id: String(w.id) } },
        { title: w.name, words: [w.name].concat(w.relayNames || []), rank: off ? '0' : '1' });
    });
  });
  each('stock lines', function() {
    stockData().items.forEach(function(it) {
      var off = it.active === false;
      add({ kind: 'stock', id: String(it.id), title: it.name || '',
        sub: [it.unit, it.basis === 'charge' ? 'charged into the bath' : '', off ? 'Inactive' : ''].filter(Boolean).join(' · ') || 'Stock line',
        text: 'Stock line ' + (it.name || '') + (it.unit ? ', in ' + it.unit : '') + (off ? ', inactive' : '') + '.',
        go: { kind: 'stock', id: String(it.id) } },
        { title: it.name, words: [it.name, it.key].concat(stockAliases(it)), rank: off ? '0' : '1' });
    });
  });
  each('bank rows', function() {
    var rows = bankData().rows;
    if (!rows.length) return;
    // What each row is, as the statement reads it: its payee, its category, the client or hand it was placed on.
    var cls;
    try { cls = bankClassify(); } catch (err) { cls = bankRows().map(function(r) { return { row: r, party: bankPartyOf(r.narration), cat: '' }; }); }
    cls.forEach(function(v) {
      var r = v.row, out = r.dr > 0, amt = out ? r.dr : r.cr, inst = bankInstrument(r), chq = /^\d{4,}$/.test(inst) ? inst : '';
      var client = v.clientId != null ? ((S.clients || []).find(function(c) { return String(c.id) === String(v.clientId); }) || {}).name : '';
      var who = client || (v.staffId != null ? ((staffById(v.staffId) || {}).name || '') : '');
      var cat = v.cat ? bankCatLabel(v.cat) : '', title = v.party || r.narration || 'Bank row';
      add({ kind: 'bank', id: String(r.id), title: title,
        sub: [formatDate(r.date), (out ? '\u2212' : '+') + formatCurrency(amt), cat + (cat && who ? ': ' + who : ''), chq ? 'cheque ' + chq : ''].filter(Boolean).join(' · '),
        text: 'Bank ' + (out ? 'payment' : 'receipt') + ' on ' + formatDate(r.date) + ': ' + formatCurrency(amt) + ', ' + (r.narration || '') + (cat ? ', ' + cat : '') + (who ? ', ' + who : '') + (chq ? ', cheque ' + chq : '') + '.',
        go: { kind: 'bank', id: String(r.id) } },
        { title: title, words: [r.narration, v.party, who, cat, chq ? 'cheque chq' : ''], ids: [inst, r.chq], nums: [r.chq], primary: [chq],
          amounts: [amt], dates: [r.date], rank: (r.date || '') + srchPad(r.dayIdx) });
    });
  });
  each('quotations', function() {
    getQuotations().forEach(function(q) {
      var items = (q.lines || []).map(function(l) { return [l.item, l.partNumber].filter(Boolean).join(' '); }), status = String(q.status || '');
      var word = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
      add({ kind: 'quote', id: String(q.id), title: qtNumberText(q),
        sub: [formatDate(q.date), qtRecipient(q), word].filter(Boolean).join(' · '),
        text: 'Quotation ' + qtNumberText(q) + ' to ' + qtRecipient(q) + ', dated ' + formatDate(q.date) + ': ' + items.join('; ') + ' at ' + qtRateSummary(q) + '; ' + word + '.',
        go: { kind: 'quote', id: String(q.id) } },
        { title: qtNumberText(q), words: [qtRecipient(q)].concat(items), ids: [q.displayNumber], primary: [q.num != null ? String(q.num) : ''],
          dates: [q.date], rank: (q.date || '') + srchPad(q.createdAt) });
    });
  });
  each('credit notes', function() {
    getCreditNotes().forEach(function(cn) {
      var off = cn.status === 'cancelled', invs = cn.invoiceNumbers || [];
      add({ kind: 'cn', id: String(cn.id), title: cn.displayNumber || '',
        sub: [formatDate(cn.date), cn.clientName, formatCurrency(cn.taxableValue) + ' taxable', off ? 'Cancelled' : ''].filter(Boolean).join(' · '),
        text: 'Credit note ' + (cn.displayNumber || '') + ' to ' + (cn.clientName || '') + ', dated ' + formatDate(cn.date) + ': taxable ' + formatCurrency(cn.taxableValue) +
          ', total ' + formatCurrency(cn.grandTotal) + '; ' + cnWhy(cn) + (invs.length ? '; against ' + invs.join(', ') : '') + (off ? '; cancelled' : '') + '.',
        go: { kind: 'cn', id: String(cn.id) } },
        { title: cn.displayNumber, words: [cn.clientName, cnWhy(cn)], ids: [cn.displayNumber].concat(invs),
          nums: invs.map(function(n) { return srchNumsOf(n).pop() || ''; }), primary: [cn.cnNumber || srchNumsOf(cn.displayNumber)[0]],
          amounts: [cn.taxableValue, cn.grandTotal], dates: [cn.date], rank: (cn.date || '') + srchPad(cn.createdAt) });
    });
  });
  _srchCache = { s: S, w: _bookWrites, list: list, keys: keys, byKey: byKey, ms: performance.now() - t0, parts: parts };
  return _srchCache;
}

/* What an entry is matched on, as strings searched with one indexOf each: a space before every word, so a word's start
   is ' ' + it. t: the title's words (a name's; an identifier's title is matched whole, in ti, so SEP in every invoice
   number is never a word), w: the words, k: the identifiers whole, n and p: the numbers and the record's own number,
   a: amounts in paise, d: dates. memo keeps what a text folds to for one build: a client's name, a part's description
   and a P.O. come round on hundreds of records. */
var SRCH_KIND_KEYS = null;
function srchKeys(kind, m, memo) {
  memo = memo || {};
  if (!SRCH_KIND_KEYS) {
    SRCH_KIND_KEYS = {};
    Object.keys(SRCH_KIND_WORDS).forEach(function(k) { SRCH_KIND_KEYS[k] = SRCH_KIND_WORDS[k].split(' ').map(srchIdKey).join(' '); });
  }
  var fold = function(s) {
    var hit = memo['w' + s];
    if (hit !== undefined) return hit;
    var ws = srchWordsOf(s);
    // A name written as one word reads too: "sssmeh" for SSS MEHTA.
    if (/[^A-Za-z0-9]/.test(String(s).trim())) { var whole = srchIdKey(s); if (whole) ws.push(whole); }
    return (memo['w' + s] = ws.join(' '));
  };
  var idKey = function(s) { var hit = memo['k' + s]; return hit !== undefined ? hit : (memo['k' + s] = srchIdKey(s)); };
  var ident = srchKindOf(kind).ident, words = [], ids = [], nums = [], prim = [], amts = [], dates = [];
  (m.words || []).forEach(function(s) { if (s) { var f = fold(s); if (f) words.push(f); } });
  if (SRCH_KIND_KEYS[kind]) words.push(SRCH_KIND_KEYS[kind]);
  (m.ids || []).forEach(function(s) { if (s) { var k = idKey(s); if (k) ids.push(k); } });
  (m.primary || []).forEach(function(s) { srchNumsOf(s).forEach(function(n) { prim.push(n); nums.push(n); }); });
  (m.nums || []).forEach(function(s) { if (s) srchNumsOf(s).forEach(function(n) { nums.push(n); }); });
  (m.amounts || []).forEach(function(v) { var p = srchPaise(v); if (p) amts.push(p); });
  (m.dates || []).forEach(function(d) { if (/^\d{4}-\d{2}-\d{2}$/.test(d || '')) dates.push(d); });
  return {
    t: ident ? '' : ' ' + srchWordsOf(m.title).join(' '),
    ti: ' ' + srchIdKey(m.title),
    w: ' ' + words.join(' '),
    k: ' ' + ids.join(' '),
    n: ' ' + nums.join(' ') + ' ',
    p: ' ' + prim.join(' ') + ' ',
    a: ' ' + amts.join(' ') + ' ',
    d: ' ' + dates.join(' ') + ' ',
    r: m.rank || ''
  };
}

/* ---------- Matching ---------- */
var SRCH_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
function srchMonthOf(w) {
  if (!/^[A-Z]{3,9}$/.test(w || '')) return 0;
  return SRCH_MONTHS.findIndex(function(m) { return m.indexOf(w) === 0; }) + 1;
}
function srchDateTok(y, m, d) {
  m = +m; d = d == null ? null : +d;
  if (!(m >= 1 && m <= 12) || (d != null && !(d >= 1 && d <= 31))) return null;
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return { t: 'date', y: y == null ? null : String(y).length === 2 ? '20' + y : String(y), m: pad(m), d: d == null ? null : pad(d) };
}
function srchTxtTok(p) {
  var sq = srchIdKey(p);
  if (!sq) return null;
  // A word holding digits, or written with its punctuation (SEP/2026-27/00834, DA1/00877, 165X83(40X6), sep/test), is an
  // identifier: matched whole against the record's numbers as well as its words, else part by part. A plain word is
  // matched against words alone, so SEP never finds every invoice by its series.
  var bits = String(p).split(/[^A-Za-z0-9]+/).filter(Boolean);
  var tok = { t: 'txt', sq: sq, id: /\d/.test(sq) || bits.length > 1 };
  if (bits.length > 1) tok.parts = bits.map(function(b) { return /^\d+$/.test(b) ? { t: 'num', n: b.replace(/^0+(?=\d)/, '') } : { t: 'txt', sq: srchIdKey(b), id: /\d/.test(b) }; });
  return tok;
}
/* The query, read into tokens: amounts, dates, numbers and text. */
function srchParse(q) {
  var out = [];
  String(q || '').split(/\s+/).forEach(function(raw) {
    var p = raw.replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d,;:!?]+$/g, '').replace(/\.$/, '');
    var cur = /^(\u20b9|rs\.?|inr)(?=\d|$)/i.test(p);
    p = p.replace(/^(\u20b9|rs\.?|inr)(?=\d|$)/i, '');
    if (!p) return;
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(p))) { var di = srchDateTok(m[1], m[2], m[3]); if (di) { out.push(di); return; } }
    if ((m = /^(\d{1,2})([\/-])(\d{1,2})(?:\2(\d{2}|\d{4}))?$/.exec(p)) || (m = /^(\d{1,2})(\.)(\d{1,2})\2(\d{2}|\d{4})$/.exec(p))) {
      var dd = srchDateTok(m[4] == null ? null : m[4], m[3], m[1]);
      if (dd) { out.push(dd); return; }
    }
    if ((cur && /^\d[\d,]*(\.\d{1,2})?$/.test(p)) || /^\d{1,3}(,\d{2,3})+(\.\d{1,2})?$/.test(p) || /^\d+\.\d{1,2}$/.test(p)) {
      out.push({ t: 'amt', paise: String(Math.round(parseFloat(p.replace(/,/g, '')) * 100)) });
      return;
    }
    if (/^#?\d+$/.test(p)) {
      var n = p.replace(/^#/, '').replace(/^0+(?=\d)/, '');
      out.push({ t: 'num', n: n, paise: n.length <= 10 ? String(+n * 100) : '' });
      return;
    }
    var tx = srchTxtTok(p);
    if (tx) out.push(tx);
  });
  // A day and a month in words: "21 Sep", "Sep 21", "21 september 2026", "sep 2026". A month alone stays a word.
  for (var i = 0; i < out.length; i++) {
    var t = out[i], mo = t.t === 'txt' && !t.id ? srchMonthOf(t.sq) : 0;
    if (!mo) continue;
    var dayAt = -1, isDay = function(x) { return x && x.t === 'num' && x.n.length <= 2 && +x.n >= 1 && +x.n <= 31; };
    if (isDay(out[i - 1])) dayAt = i - 1; else if (isDay(out[i + 1])) dayAt = i + 1;
    var yAt = Math.max(i, dayAt) + 1, y = out[yAt], year = y && y.t === 'num' && /^(20\d\d|\d\d)$/.test(y.n) && (dayAt >= 0 || y.n.length === 4) ? y.n : null;
    if (dayAt < 0 && year == null) continue;
    var tok = srchDateTok(year, mo, dayAt >= 0 ? out[dayAt].n : null);
    if (!tok) continue;
    var from = Math.min(i, dayAt < 0 ? i : dayAt), to = year != null ? yAt : Math.max(i, dayAt);
    out.splice(from, to - from + 1, tok);
    i = from;
  }
  return out;
}
function srchDateHit(tk, ds) {
  if (tk.y && tk.d) return ds.indexOf(' ' + tk.y + '-' + tk.m + '-' + tk.d + ' ') >= 0;
  if (tk.d) return ds.indexOf('-' + tk.m + '-' + tk.d + ' ') >= 0;
  return ds.indexOf(' ' + tk.y + '-' + tk.m + '-') >= 0;
}
/* How well one token matches one entry: 0 is no match. The record's own number scores highest, then a title. */
function srchTokScore(tk, k) {
  switch (tk.t) {
    case 'num':
      if (k.p.indexOf(' ' + tk.n + ' ') >= 0) return 5;
      if (k.n.indexOf(' ' + tk.n + ' ') >= 0) return 2;
      return tk.paise && k.a.indexOf(' ' + tk.paise + ' ') >= 0 ? 1 : 0;
    case 'amt': return k.a.indexOf(' ' + tk.paise + ' ') >= 0 ? 4 : 0;
    case 'date': return srchDateHit(tk, k.d) ? 2 : 0;
    case 'txt': {
      if (k.t.indexOf(' ' + tk.sq) >= 0) return 3;
      if (tk.id && k.ti.indexOf(' ' + tk.sq) >= 0) return 4;
      if (k.w.indexOf(' ' + tk.sq) >= 0) return tk.id ? 2 : 1;
      if (tk.id && k.k.indexOf(' ' + tk.sq) >= 0) return 2;
      if (!tk.parts) return 0;
      var s = 0;
      for (var i = 0; i < tk.parts.length; i++) { var x = srchTokScore(tk.parts[i], k); if (!x) return 0; s += x; }
      return s;
    }
  }
  return 0;
}
/* Every entry matching every token, grouped by kind in SRCH_KINDS' order, best first. */
function srchQuery(q) {
  var t0 = performance.now(), d = srchData(), toks = srchParse(q), whole = ' ' + srchIdKey(q);
  var by = {}, total = 0;
  if (toks.length) {
    for (var i = 0; i < d.keys.length; i++) {
      var k = d.keys[i], score = 0;
      for (var j = 0; j < toks.length; j++) {
        var s = srchTokScore(toks[j], k);
        if (!s) { score = 0; break; }
        score += s;
      }
      if (!score) continue;
      if (k.ti === whole) score += 6;    // the whole query is the title
      var kind = d.list[i].kind;
      (by[kind] = by[kind] || []).push({ i: i, s: score, r: k.r });
      total++;
    }
  }
  var groups = SRCH_KINDS.filter(function(x) { return by[x[0]]; }).map(function(x) {
    var hits = by[x[0]].sort(function(a, b) {
      return b.s - a.s || (a.r < b.r ? 1 : a.r > b.r ? -1 : 0) || String(d.list[a.i].title).localeCompare(String(d.list[b.i].title));
    });
    return { kind: x[0], items: hits.map(function(h) { return h.i; }) };
  });
  return { tokens: toks, groups: groups, total: total, ms: performance.now() - t0 };
}

/* ---------- The palette ---------- */
var _srch = null;    // the open palette: {q, shown: [{e} | {more: kind}], cursor, all: {kind: true}, drawn: the list's html}

function srchRecent() {
  try {
    var a = JSON.parse(localStorage.getItem(SRCH_RECENT_KEY) || '[]');
    return Array.isArray(a) ? a.filter(function(x) { return x && x.kind && x.id != null; }) : [];
  } catch (e) { return []; }
}
/* Each with what it was drawn as and where it goes, so Recent is drawn before the index is built; once it is, a record
   since deleted is left out and a changed one drawn as it is now. */
function srchRecentPush(e) {
  var a = srchRecent().filter(function(x) { return !(x.kind === e.kind && String(x.id) === String(e.id)); });
  a.unshift({ kind: e.kind, id: String(e.id), title: e.title || '', sub: e.sub || '', go: e.go });
  try { localStorage.setItem(SRCH_RECENT_KEY, JSON.stringify(a.slice(0, SRCH_RECENT_N))); } catch (err) { /* a per-device convenience only */ }
}

function srchKbd(k) { return '<kbd class="inv-kbd">' + escHtml(k) + '</kbd>'; }

/* Opens search; q fills the field (another screen can open it on a query). */
function searchOpen(q) {
  var open = document.querySelector('[data-search]');
  if (open) { var f = document.getElementById('srchInput'); if (f) f.focus(); return; }
  _srch = { q: q || '', shown: [], cursor: -1, all: {} };
  var hints = '<span>' + srchKbd('\u2191') + srchKbd('\u2193') + ' move</span><span>' + srchKbd('Enter') + ' open</span>' +
    '<span>' + srchKbd('Ctrl') + srchKbd('Enter') + ' in a new window</span><span>' + srchKbd('Esc') + ' close</span>' +
    '<button type="button" class="inv-btn-link" data-action="invSearchKeys">Every key</button>';
  var scrim = dialogOpen('<div class="inv-dialog inv-dialog-palette" role="dialog" aria-modal="true" aria-labelledby="srchTitle" data-search>' +
    dialogHeadHtml('<span id="srchTitle">Search</span>', 'invCloseConfirm', 'Close search') +
    '<label class="inv-search">' + ICON_SEARCH + '<input type="search" id="srchInput" role="combobox" aria-expanded="true" aria-controls="srchList" aria-autocomplete="list"' +
    ' aria-label="Search the book and the screens" placeholder="Invoice, challan, client, amount, screen" autocomplete="off" autocapitalize="off" spellcheck="false"' +
    ' enterkeyhint="go" value="' + escHtml(_srch.q) + '"></label>' +
    '<div class="inv-panel inv-panel-flush" id="srchList" role="listbox" aria-label="Results"></div>' +
    '<p class="inv-visually-hidden" role="status" id="srchStatus"></p>' +
    '<div class="inv-keys">' + hints + '</div></div>', { dismiss: true });
  scrim.addEventListener('input', function(e) {
    if (e.target.id !== 'srchInput' || !_srch) return;
    _srch.q = e.target.value;
    _srch.all = {};
    srchRender();
  });
  scrim.addEventListener('keydown', srchOnKey);
  // A press on a result leaves the cursor in the field, as in a suggestion list: the keys go on working after a Ctrl+click
  // (a result opened in another window) or a Show all.
  scrim.addEventListener('mousedown', function(e) { if (e.target.closest && e.target.closest('#srchList [role="option"]')) e.preventDefault(); });
  srchRender();
  var inp = document.getElementById('srchInput');
  if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }
  // Recent and Go to need no index, so the palette is on screen at once; the index is built just after (on the real book
  // it takes tens of milliseconds), and Recent is drawn again from it if anything in it has changed.
  if (!srchFresh()) setTimeout(function() {
    if (!_srch) return;
    srchData();
    if (!_srch.q.trim()) srchRender();
  }, 0);
}
function srchClose() {
  var box = document.querySelector('[data-search]'), scrim = box && box.closest('.inv-scrim-dialog');
  _srch = null;
  if (scrim) dialogCloseScrim(scrim);
}

function srchOptHtml(n, e) {
  var kd = srchKindOf(e.kind);
  return '<button type="button" class="inv-row inv-row-2" role="option" id="srchOpt' + n + '" tabindex="-1" aria-selected="false" data-action="invSearchPick" data-n="' + n + '">' +
    '<span class="inv-row-main"><span class="inv-row-title' + (kd.ident ? ' inv-id' : '') + '">' + escHtml(e.title || kd.one) + '</span>' +
    (e.sub ? '<span class="inv-row-meta">' + escHtml(e.sub) + '</span>' : '') + '</span>' +
    '<span class="inv-row-end"><span class="inv-badge inv-badge-neutral">' + escHtml(kd.one) + '</span></span></button>';
}
function srchGroupHtml(key, label, count, inner) {
  return '<div role="group" aria-labelledby="srchG-' + key + '"><div class="inv-row-group" id="srchG-' + key + '"><span>' + escHtml(label) + '</span>' +
    (count != null ? '<span class="inv-num">' + count + '</span>' : '') + '</div>' + inner + '</div>';
}

/* The list under the field: Recent and Go to before anything is typed, the results after. */
function srchRender() {
  var box = document.getElementById('srchList'), inp = document.getElementById('srchInput'), status = document.getElementById('srchStatus');
  if (!box || !_srch) return;
  var q = _srch.q.trim(), html = '', shown = [], say = '';
  var row = function(e) { shown.push({ e: e }); return srchOptHtml(shown.length - 1, e); };
  if (!q) {
    // Recent: what was opened from here, as the book has it now (one since deleted is left out) once the index is built,
    // and as it was drawn until then. Go to: the workspaces' screens.
    var d0 = srchFresh() ? _srchCache : null;
    var rec = srchRecent().map(function(r) {
      if (d0) { var i = d0.byKey[r.kind + '|' + r.id]; return i == null ? null : d0.list[i]; }
      return r.title && r.go ? { kind: r.kind, id: String(r.id), title: r.title, sub: r.sub || '', text: '', go: r.go } : null;
    }).filter(Boolean);
    if (rec.length) html += srchGroupHtml('recent', 'Recent', null, rec.map(row).join(''));
    var screens = srchScreens(), go = [];
    SRCH_SPACES.forEach(function(sp) { sp[2].forEach(function(id) { var x = screens.find(function(y) { return y[0] === id; }); if (x) go.push(srchScreenEntry(x)); }); });
    html += srchGroupHtml('goto', 'Go to', null, go.map(row).join(''));
    say = (rec.length ? rec.length + ' recent, then ' : '') + 'places to go';
  } else {
    var d = srchData(), res = srchQuery(q);
    _srch.ms = res.ms;
    res.groups.forEach(function(g) {
      var kd = srchKindOf(g.kind), all = !!_srch.all[g.kind];
      var n = Math.min(g.items.length, all ? SRCH_ALL_MAX : SRCH_PER_KIND);
      var inner = g.items.slice(0, n).map(function(i) { return row(d.list[i]); }).join('');
      if (!all && g.items.length > n) {
        shown.push({ more: g.kind });
        inner += '<button type="button" class="inv-row" role="option" id="srchOpt' + (shown.length - 1) + '" tabindex="-1" aria-selected="false" data-action="invSearchPick" data-n="' + (shown.length - 1) + '">' +
          '<span class="inv-row-main inv-btn-link">Show all ' + g.items.length + ' ' + escHtml(kd.group.toLowerCase()) + '</span></button>';
      } else if (g.items.length > n) {
        inner += '<div class="inv-row"><span class="inv-row-main inv-row-meta">' + (g.items.length - n) + ' more: type more to narrow it</span></div>';
      }
      html += srchGroupHtml(g.kind, kd.group, g.items.length, inner);
    });
    if (!res.groups.length) {
      html = '<div class="inv-empty">Nothing matches &ldquo;' + escHtml(q) + '&rdquo;. Search reads invoices, challans, clients, parts, workers, stock lines, ' +
        'bank rows, quotations, credit notes and the screens; a number matches whole, an amount to the paisa.</div>';
    }
    say = res.total ? res.total + ' result' + (res.total === 1 ? '' : 's') : 'Nothing matches';
  }
  _srch.shown = shown;
  if (inp) inp.setAttribute('aria-expanded', 'true');
  if (status) status.textContent = say;
  // The same list again (a space typed, Recent found unchanged once the index is built) is left as it is, cursor and all.
  if (html === _srch.drawn) return;
  _srch.drawn = html;
  box.innerHTML = html;
  srchCursor(shown.length ? 0 : -1);
}

function srchCursor(n) {
  var box = document.getElementById('srchList'), inp = document.getElementById('srchInput');
  if (!box || !_srch) return;
  var opts = box.querySelectorAll('[role="option"]');
  if (n >= opts.length) n = opts.length - 1;
  _srch.cursor = n;
  Array.prototype.forEach.call(opts, function(o, i) { o.setAttribute('aria-selected', i === n ? 'true' : 'false'); });
  var on = n >= 0 ? opts[n] : null;
  if (inp) { if (on) inp.setAttribute('aria-activedescendant', on.id); else inp.removeAttribute('aria-activedescendant'); }
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}

function srchOnKey(e) {
  if (!_srch || !e.target || e.target.id !== 'srchInput') return;
  var len = _srch.shown.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    if (len) srchCursor(((_srch.cursor < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : _srch.cursor) + (e.key === 'ArrowDown' ? 1 : -1) + len) % len);
    return;
  }
  if (e.key === 'Enter') {
    // Taken here, so the app's Enter-to-the-next-field (events.js) never sees it.
    e.preventDefault();
    e.stopPropagation();
    if (e.isComposing || _srch.cursor < 0) return;
    if ((e.ctrlKey || e.metaKey) && _isDesktop) {
      var s = _srch.shown[_srch.cursor];
      if (s && s.e) srchOpenWindow(srchEntryLoc(s.e));
      return;
    }
    srchActivate(_srch.cursor);
  }
}

/* An option chosen: Show all opens its kind in place; anything else closes search and makes its jump. */
function srchActivate(n) {
  var s = _srch && _srch.shown[n];
  if (!s) return;
  if (s.more) {
    _srch.all[s.more] = true;
    srchRender();
    srchCursor(n);
    return;
  }
  srchPick(s.e);
}
function srchPick(e) {
  srchRecentPush(e);
  srchClose();
  // Leaving a form with unsaved work asks first, as any move off it does (nav.js); a Settings section, a credit note and
  // the phone's invoice sheet open over the screen and leave nothing.
  if (srchStays(e.go) || !navFormDirty()) { srchGo(e.go); return; }
  navLeaveOk().then(function(ok) { if (ok) srchGo(e.go); });
}
function srchStays(go) {
  return !go || go.kind === 'settings' || go.kind === 'cn' || (go.kind === 'invoice' && !_isDesktop);
}

/* ---------- The jumps ---------- */
/* A place by its address, as one step: pushed first, then put on screen (navApply writes where it landed into that step).
   The search's own layer step is passed over by back, as any layer shut by something other than back. The page on screen
   is no step: the same address, or the same page where it has no views (Home until Needs you and Pulse are its views). */
function srchGoPlace(loc) {
  var cur = navLoc();
  if (!loc || !isPageId(loc.tab) || navKey(loc) === navKey(cur) || (loc.tab === cur.tab && !cur.v && !loc.id)) return;
  var st = history.state;
  if (st && st.sep && st.layer) history.replaceState(Object.assign({}, st, { layer: false, skip: true }), '', window.location.href);
  navPush(loc);
  navApply(loc);
}
function srchMissing(what) { showToast(what + ' is no longer in the book', 'warning'); }

function srchGo(go) {
  if (!go) return;
  var id = go.id != null ? String(go.id) : '';
  switch (go.kind) {
    case 'place': srchGoPlace(go.loc); return;
    case 'act': srchAct(go.act); return;
    case 'invoice': {
      var inv = (S.invoices || []).find(function(i) { return String(i.id) === id; });
      if (!inv) { srchMissing('That invoice'); return; }
      // The desktop's Register with it open in the pane (History's jump); the phone's sheet over the screen.
      if (_isDesktop) { regJump({ search: inv.displayNumber || '' }); _renderRegDetail(inv.id); }
      else openInvoiceDetail(inv.id);
      return;
    }
    case 'client': {
      var c = (S.clients || []).find(function(x) { return String(x.id) === id; });
      if (!c) { srchMissing('That client'); return; }
      _qtForm = null;
      setItemsSubView('clients');
      switchTab('pageClients');
      if (_isDesktop) _renderClientDetail(c.id); else openClientEdit(c.id);
      return;
    }
    case 'part': {
      var p = (S.items || []).find(function(x) { return String(x.id) === id; });
      if (!p) { srchMissing('That part'); return; }
      // Items on it: the list searched for it, the filters it does not set cleared (a jump shows what it names).
      regFilter.itemsSearch = p.partNumber || '';
      regFilter.itemsFilter = 'all';
      saveRegFilter();
      _qtForm = null;
      setItemsSubView('items');
      switchTab('pageClients');
      if (_isDesktop) _renderItemDetail(p.id); else openItemEdit(p.id);
      return;
    }
    case 'worker': {
      var w = staffById(id);
      if (!w) { srchMissing('That worker'); return; }
      _attView = 'roster';
      switchTab('pageStaff');
      uiRevealEl(document.querySelector('#pageStaff [data-action="invAttEditWorker"][data-id="' + w.id + '"]'));
      openWorkerEdit(w.id);
      return;
    }
    case 'bank': {
      var r = bankData().rows.find(function(x) { return String(x.id) === id; });
      if (!r) { srchMissing('That bank row'); return; }
      // Money → Bank filtered to it, its row open: by its cheque number where it has one, else its narration.
      var inst = bankInstrument(r);
      _bankFilter = { cat: '', q: /^\d{4,}$/.test(inst) ? inst : (r.narration || '') };
      _bankEdit = r.id;
      _bankSortFrom = null;
      finSetTab('bank');
      if (navPageOf() === 'pageFinance') { renderFinance(); viewTop(); } else switchTab('pageFinance');
      uiRevealEl(document.querySelector('[data-bank-row="' + String(r.id).replace(/["\\]/g, '\\$&') + '"]'));
      return;
    }
    case 'quote': if (qtFind(id)) qtOpen(id, true); else srchMissing('That quotation'); return;
    case 'cn':
      if (getCreditNotes().some(function(x) { return String(x.id) === id; })) showCreditNotePreview(id); else srchMissing('That credit note');
      return;
    // Settings opens once (events.js's rule for its button).
    case 'settings': if (!document.getElementById('settingsScrim')) openSettings(go.sec); return;
  }
  // A challan, a stock line, the credit notes, the number audit, a bill: the To-do's own jumps.
  todoGo(go);
}

/* The actions: each opens its place on the job, as Home's quick actions do. */
function srchAct(a) {
  switch (a) {
    case 'invoice': createNew(); break;
    case 'challan': homeQuick('challan'); break;
    case 'stock': homeQuick('stock'); break;
    case 'task': homeQuick('task'); break;
    case 'paste': relayOpen(); break;
    case 'quote': qtOpenForm(null); break;
    case 'client': _qtForm = null; setItemsSubView('clients'); switchTab('pageClients'); openClientAdd(); break;
    case 'item': _qtForm = null; setItemsSubView('items'); switchTab('pageClients'); openItemAdd(); break;
    case 'worker': _attView = 'roster'; switchTab('pageStaff'); openWorkerAdd(); break;
  }
}

/* ---------- Keys ---------- */
var _srchG = 0;    // when G was pressed: a letter within SRCH_G_MS jumps

/* A field being typed in: a text box, a select, an editable block. A tick box or a button is not. */
function srchTyping(t) {
  if (!t || !t.tagName) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/i.test(t.type || 'text');
}
/* G then a letter: the workspace's first screen this build holds, or Invoices (R) and Challans (C). */
function srchGTarget(letter) {
  var sp = SRCH_SPACES.find(function(x) { return x[0] === letter; }), ids = sp ? sp[2] : SRCH_G_MORE[letter];
  if (!ids) return null;
  var screens = srchScreens();
  for (var i = 0; i < ids.length; i++) {
    var x = screens.find(function(s) { return s[0] === ids[i]; });
    if (x) return x[4];
  }
  return null;
}
/* A key that leaves the screen asks first when it holds unsaved work, as a tap does (nav.js). */
function srchKeyGo(go) { navLeaveOk().then(function(ok) { if (ok) srchGo(go); }); }

/* J and K walk the rows of Invoices and Challans (the phone's row buttons, the desktop's identifiers); Enter on one opens
   it, as a button does. */
var SRCH_ROW_SEL = {
  pageRegister: 'button[data-action="invViewInvoiceDetail"], tbody button[data-action="invSelectRegRow"]',
  pageIM: 'button[data-action="invToggleIM"], tbody button[data-action="invSelectIMRow"]'
};
function srchRowStep(d) {
  var page = document.querySelector('.inv-page-active'), sel = page && SRCH_ROW_SEL[page.id];
  if (!sel) return false;
  var rows = Array.prototype.filter.call(page.querySelectorAll(sel), function(b) { return b.offsetParent !== null; });
  if (!rows.length) return false;
  var cur = rows.indexOf(document.activeElement);
  var next = cur < 0 ? (d > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, cur + d));
  rows[next].focus();
  return true;
}
/* Esc on the desktop shuts the pane open beside a list, through its own close button. */
function srchPaneClose() {
  if (!_isDesktop) return false;
  var x = document.querySelector('.inv-page-active .inv-pane-open .inv-pane-head > button[data-action]');
  if (!x) return false;
  x.click();
  return true;
}

document.addEventListener('keydown', function(e) {
  if (!S || e.defaultPrevented || e.isComposing) return;
  var key = e.key || '', t = e.target;
  // Ctrl K (Cmd K on a Mac): search, from anywhere but a field being typed in or another layer.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'k' || key === 'K')) {
    if (t && t.closest && t.closest('[data-search]')) { e.preventDefault(); return; }
    if (navLayerOpen() || (srchTyping(t) && !(t === _navArrivalField && !t.value))) return;
    e.preventDefault();
    searchOpen();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || navLayerOpen() || srchTyping(t)) { _srchG = 0; return; }
  if (e.repeat) return;
  if (_srchG) {
    var g = Date.now() - _srchG < SRCH_G_MS ? srchGTarget(key.toLowerCase()) : null;
    _srchG = 0;
    if (g) { e.preventDefault(); srchKeyGo(g); return; }
  }
  switch (key) {
    case '/': e.preventDefault(); searchOpen(); return;
    case '?': e.preventDefault(); srchKeysOpen(); return;
    case 'g': case 'G': e.preventDefault(); _srchG = Date.now(); return;
    case 'n': case 'N': e.preventDefault(); srchKeyGo({ kind: 'act', act: 'invoice' }); return;
    case 'c': case 'C': e.preventDefault(); srchKeyGo({ kind: 'act', act: 'challan' }); return;
    case 'j': case 'J': if (srchRowStep(1)) e.preventDefault(); return;
    case 'k': case 'K': if (srchRowStep(-1)) e.preventDefault(); return;
    case 'Escape': if (srchPaneClose()) e.preventDefault(); return;
  }
});

/* ? : every key, as rows. */
function srchKeysOpen() {
  var k = srchKbd, or = function(a, b) { return a + ' or ' + b; };
  var groups = [
    ['When no field has focus', [['Search', or(k('Ctrl K'), k('/'))], ['Add', k('A')], ['New invoice', k('N')], ['New challan', k('C')], ['This list', k('?')]]],
    ['G, then a letter', [['Today', k('G') + k('T')], ['Office', k('G') + k('O')], ['Floor', k('G') + k('F')], ['Money', k('G') + k('M')],
      ['Insights', k('G') + k('I')], ['Invoices', k('G') + k('R')], ['Challans', k('G') + k('C')]]],
    ['Invoices and Challans', [['Next row', k('J')], ['Previous row', k('K')], ['Open the row', k('Enter')], ['Close the pane', k('Esc')]]],
    ['Search', [['Move', k('\u2191') + k('\u2193')], ['Open', k('Enter')], ['Open in a new window', k('Ctrl') + k('Enter')]]],
    ['Anywhere', [['Back', or(k('Backspace'), k('Alt') + k('\u2190'))], ['Close a dialog or search', k('Esc')],
      ['Open in a new window', or(k('Ctrl') + ' click', 'middle click')]]]
  ];
  dialogOpen('<div class="inv-dialog" data-keys-list>' + dialogHeadHtml('Keys', 'invCloseConfirm') +
    '<div class="inv-panel inv-panel-flush">' + groups.map(function(g) {
      return '<div class="inv-row-group"><span>' + escHtml(g[0]) + '</span></div>' + g[1].map(function(r) {
        return '<div class="inv-row"><span class="inv-row-main">' + escHtml(r[0]) + '</span><span class="inv-row-end">' + r[1] + '</span></div>';
      }).join('');
    }).join('') + '</div>' +
    '<p class="inv-note">None of them works while you are typing in a field; Ctrl K also works from a search the app has just put the cursor in. ' +
    'New windows are the desktop&rsquo;s.</p></div>', { dismiss: true });
}

/* ---------- New windows (desktop) ---------- */
function srchOpenWindow(loc) {
  if (!loc || !isPageId(loc.tab)) return false;
  var w = null;
  try { w = window.open(navUrl(loc), '_blank'); } catch (e) { w = null; }
  if (!w) showToast('The browser did not open a new window: allow pop-ups for this app and try again', 'warning');
  return true;
}
/* The place a record lives at, by its address (nav.js): what a new window opens. */
function srchRecordLoc(kind, id) {
  if (kind === 'invoice') return (S.invoices || []).some(function(i) { return String(i.id) === id; }) ? { tab: 'pageRegister', v: '', id: id } : null;
  if (kind === 'challan') {
    var im = (S.incomingMaterial || []).find(function(m) { return String(m.id) === id; });
    return im ? { tab: 'pageIM', v: imIsBilled(im) ? 'invoiced/' + String(im.challanDate || '').slice(0, 7) : 'awaiting', id: String(im.id) } : null;
  }
  if (kind === 'client') return { tab: 'pageClients', v: 'clients', id: id };
  if (kind === 'quote') return { tab: 'pageClients', v: 'quotes', id: id };
  if (kind === 'stock') return { tab: 'pageStock', v: 'item', id: id };
  return null;
}
/* Where a search result is, as an address; a Settings section and an action are not places. */
function srchEntryLoc(e) {
  var go = e && e.go, id = go && go.id != null ? String(go.id) : '';
  if (!go) return null;
  if (go.kind === 'place') return go.loc;
  if (/^(invoice|challan|client|quote|stock)$/.test(go.kind)) return srchRecordLoc(go.kind, id);
  var page = { part: ['pageClients', 'items'], worker: ['pageStaff', 'roster'], bank: ['pageFinance', 'bank'], bills: ['pageFinance', 'bills'],
    cnList: ['pageRegister', ''], audit: ['pageRegister', ''], cn: ['pageRegister', ''] }[go.kind];
  return page ? { tab: page[0], v: page[1], id: '' } : null;
}
/* A row's action and the record it opens. */
var SRCH_ROW_KINDS = { invSelectRegRow: 'invoice', invViewInvoiceDetail: 'invoice', invHistoryJumpInvoice: 'invoice',
  invSelectIMRow: 'challan', invToggleIM: 'challan', invHistoryJumpChallan: 'challan', invSelectClientRow: 'client',
  invEditClient: 'client', invQtOpen: 'quote', invStockOpen: 'stock' };
/* The place a click on el would open: a sidebar or bar item, a workspace, a view tab, a list row. Null for anything else,
   and for anything in a dialog or a sheet but a search result. */
function srchLocOf(el) {
  var a = el && el.closest ? el.closest('[data-action]') : null;
  if (!a) return null;
  var act = a.dataset.action, d = a.dataset;
  if (act === 'invSearchPick') { var s = _srch && _srch.shown[+d.n]; return s && s.e ? srchEntryLoc(s.e) : null; }
  if (a.closest('.inv-scrim')) return null;
  if (act === 'invSwitchTab' || act === 'invSideGo') return isPageId(d.tab) ? { tab: d.tab, v: d.sub || '', id: '' } : null;
  if (act === 'invWsGo') {
    var sp = SRCH_SPACES.find(function(x) { return x[1].toLowerCase() === String(d.ws || '').toLowerCase(); });
    var go = sp ? srchGTarget(sp[0]) : null;
    return go && go.kind === 'place' ? go.loc : null;
  }
  if (a.classList.contains('inv-viewtab')) {
    var key = d.tab || d.view || d.v || '', page = a.closest('.inv-page');
    if (isPageId(key)) return { tab: key, v: '', id: '' };
    return page && isPageId(page.id) && key ? { tab: page.id, v: key, id: '' } : null;
  }
  if (SRCH_ROW_KINDS[act]) return srchRecordLoc(SRCH_ROW_KINDS[act], String(d.id));
  if (act === 'invSelectItemRow' || act === 'invEditItem') return { tab: 'pageClients', v: 'items', id: '' };
  if (act === 'invAttEditWorker') return { tab: 'pageStaff', v: 'roster', id: '' };
  return null;
}
/* Caught on the window before anything else sees the click, so the place opens there and not here as well (and nav.js
   does not ask about leaving a form that is not being left). */
function srchWindowClick(e) {
  if (!_isDesktop || !S) return;
  var loc = srchLocOf(e.target);
  if (!loc) return;
  e.preventDefault();
  e.stopPropagation();
  srchOpenWindow(loc);
}
window.addEventListener('click', function(e) { if (e.button === 0 && (e.ctrlKey || e.metaKey) && !e.altKey) srchWindowClick(e); }, true);
window.addEventListener('auxclick', function(e) { if (e.button === 1) srchWindowClick(e); }, true);
// A middle press on a place would start the browser's autoscroll first.
window.addEventListener('mousedown', function(e) { if (e.button === 1 && _isDesktop && S && srchLocOf(e.target)) e.preventDefault(); }, true);

function srchAction(action, btn) {
  switch (action) {
    case 'invSearchPick': srchActivate(+btn.dataset.n); return true;
    case 'invSearchKeys': srchClose(); srchKeysOpen(); return true;
    case 'invNewWindow': srchOpenWindow(navLoc()); return true;
  }
  return false;
}
