/* ===== INCOMING MATERIAL (Phase 3) ===== */
let _imExpanded = {};
let _imSelected = {}; // keyed by item id: true/false
let _imFilter = { clientId: '', status: '' }; // '' = all
let _imToolbarRendered = false;
var _imActiveChallanId = null;

/* Awaiting invoice and Invoiced are view tabs (UX overhaul 2, owner 28 Sep 2026): the eight challans still to bill led a
   list of 1,163 billed ones, 97 phone screens long. Awaiting is the default; Invoiced goes back month by month, by
   challan date, the latest month with one first. A challan part-invoiced still awaits. */
var IM_TABS = [['awaiting', 'Awaiting invoice'], ['invoiced', 'Invoiced']];
var _imTab = 'awaiting';
var _imMonth = null;   // YYYY-MM on Invoiced; null = the latest month with an invoiced challan

function imIsBilled(im) { return getIMStatus(im) === 'invoiced'; }
function imInvoicedMonths() {
  var m = {};
  (S.incomingMaterial || []).forEach(function(im) { if (imIsBilled(im)) m[String(im.challanDate || '').slice(0, 7)] = 1; });
  return Object.keys(m).sort();
}
function imMonthShown() {
  var ms = imInvoicedMonths();
  if (_imMonth && ms.indexOf(_imMonth) >= 0) return _imMonth;
  return ms.length ? ms[ms.length - 1] : null;
}
function imMonthLabel(ym) {
  var m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  if (!m) return 'No date';
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + m[1];
}
function imSetTab(t, month) {
  if (!IM_TABS.some(function(x) { return x[0] === t; })) t = 'awaiting';
  var moved = t !== _imTab || (month !== undefined && month !== _imMonth);
  _imTab = t;
  if (month !== undefined) _imMonth = month;
  // The filters and the selection belong to what was on screen.
  if (moved) { _imSelected = {}; if (t === 'invoiced') _imFilter.status = ''; }
  _imToolbarRendered = false;
  return moved;
}
/* The tab (and month) a challan is listed under, so a link to it lands where it is. */
function imShowChallanTab(im) {
  if (!im) return;
  if (imIsBilled(im)) imSetTab('invoiced', String(im.challanDate || '').slice(0, 7));
  else imSetTab('awaiting');
}
function imMonthStep(n) {
  var ms = imInvoicedMonths(), i = ms.indexOf(imMonthShown()) + n;
  if (i < 0 || i >= ms.length) return;
  imSetTab('invoiced', ms[i]);
  imRedraw();
}
/* The tabs, the toolbar and the list together: a tab or a month changes all three. */
function imRedraw() {
  renderIMToolbar();
  _imToolbarRendered = true;
  _renderIMView();
}
function imViewTabsHtml() {
  var all = S.incomingMaterial || [], billed = all.filter(imIsBilled).length;
  var n = { awaiting: all.length - billed, invoiced: billed };
  return '<div class="inv-viewtabs" role="tablist" aria-label="Challans">' + IM_TABS.map(function(t) {
    return '<button class="inv-viewtab" role="tab" aria-selected="' + (_imTab === t[0]) + '" data-action="invIMTab" data-tab="' + t[0] + '">' + t[1] +
      ' <span class="inv-panel-count">' + n[t[0]] + '</span></button>';
  }).join('') + '</div>';
}
function imMonthPagerHtml() {
  var ms = imInvoicedMonths(), cur = imMonthShown(), i = ms.indexOf(cur);
  if (!cur) return '';
  var inMonth = (S.incomingMaterial || []).filter(function(im) { return imIsBilled(im) && String(im.challanDate || '').slice(0, 7) === cur; });
  var n = inMonth.length, total = inMonth.reduce(function(s, im) { return s + imChallanTotal(im); }, 0);
  return '<div class="inv-toolbar inv-stepper" data-im-month="' + escHtml(cur) + '">' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invIMMonth" data-step="-1" aria-label="Month before"' + (i <= 0 ? ' disabled' : '') + '>' + STAFF_BACK_ICON + '</button>' +
    '<div class="inv-stepper-label"><span class="inv-stepper-title">' + escHtml(imMonthLabel(cur)) + '</span><span class="inv-stepper-sub">' + n + ' challan' + (n === 1 ? '' : 's') + ' · <span class="inv-num">' + formatCurrency(gstRound(total)) + '</span></span></div>' +
    '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invIMMonth" data-step="1" aria-label="Month after"' + (i >= ms.length - 1 ? ' disabled' : '') + '>' + STAFF_NEXT_ICON + '</button></div>';
}

/* A challan's billing state as a status (design principles §6.13): material waiting on an
   invoice is the caution; part-billed is information; fully invoiced is done. */
var IM_STATUS_UI = {
  pending: { word: 'Pending', tone: 'warning' },
  partial: { word: 'Part invoiced', tone: 'info' },
  invoiced: { word: 'Invoiced', tone: 'ok' }
};

/* Unified IM sort accessor (Phase 8D) */
function getIMSortConfig() {
  if (_isDesktop && _imFilter.desktopSort) return _imFilter.desktopSort;
  return null; // mobile uses inline sort logic, not config-driven
}

/* ===== A CHALLAN INVOICED IN PARTS =====

   Owner, 26 Sep 2026: "Samarth Engg sends 600 nos of an item, I should be able
   to invoice that challan multiple times till 600 is reached — 200 one day,
   then 300 and then 100." A challan line used to be all-or-nothing.

   What a line has been billed is DERIVED from the invoices, never typed: the
   sum of `qty` over every invoice line naming it (`imItemId`) on an invoice
   that is not cancelled. A deleted invoice is gone from S.invoices, so it frees
   its share by itself. The flags on the line (`invoiced`, `invoiceId`, and now
   `billedQty`, `billedNos`, `invoiceIds`) are a CACHE of that, written by
   imSyncBilled() after every invoice save, edit, cancel, delete and reissue and
   in migrateState(), so every reader of `it.invoiced` keeps working.

   Two older shapes are kept whole rather than reopened:
   - a line flagged invoiced whose invoice exists but names no challan line
     (saved before `imItemId` existed): fully billed by that invoice
     (`billedLegacy`), until the invoice is opened and linked, deleted, or
     cancelled (confirmCancelInvoice frees it, as it always did) — the same
     test the old orphan repair made, so nothing old is reopened;
   - an invoice line linked to it on a looser match whose quantity differed
     (`imWhole`, set by withChallanLinks): it billed the whole challan line, as
     the all-or-nothing app did. */
var IM_QTY_EPS = 0.0005;

function imQtyText(n) { return String(parseFloat(Number(n || 0).toFixed(3))); }

/* imItemId → the invoice lines billing it, oldest invoice first. */
function imBilledIndex() {
  var idx = {};
  (S.invoices || []).slice().sort(function(a, b) {
    return String(a.date || '').localeCompare(String(b.date || '')) || (a.createdAt || 0) - (b.createdAt || 0);
  }).forEach(function(inv) {
    if (inv.status === 'cancelled') return;
    (inv.items || []).forEach(function(li) {
      if (!li.imItemId) return;
      // Read as numbers: a quantity stored as text (a scanned challan's "282.70") added up as text and threw at the
      // toFixed below, in the invoice save and in the billing sync at every boot.
      (idx[li.imItemId] || (idx[li.imItemId] = [])).push({ invoiceId: inv.id, displayNumber: inv.displayNumber, invoiceNumber: inv.invoiceNumber,
        date: inv.date, qty: Number(li.qty) || 0, nosQty: Number(li.nosQty) || 0, whole: !!li.imWhole, unit: li.unit || '' });
    });
  });
  return idx;
}

/* What a set of refs bills of one challan line.
   A ref billed in ANOTHER UNIT than the challan line's (a NOS challan line invoiced by the kilo, or
   the reverse) bills it WHOLE: 120 kg cannot be netted against 600 pieces, and leaving the line open
   would show phantom unbilled material on Home, Stats and the To-do for ever. The invoice line says
   so as it is typed, and carries the reason it was given (`unitChangeAck`). */
function imRefWhole(it, r) {
  return r.whole || (!!r.unit && !!it.unit && r.unit !== it.unit);
}
function imRefsBilled(it, refs) {
  var qty = 0, nos = 0, whole = false;
  refs.forEach(function(r) {
    if (imRefWhole(it, r)) { whole = true; return; }
    qty += r.qty;
    // A NOS line's pieces ARE its quantity: a share of it bills that share of the pieces, whatever pieces figure the
    // invoice line carried (one saved from a part dispatch kept the challan's whole count, 600 under a 200 dispatch).
    nos += it.unit === 'NOS' && it.nosQty && it.qty > 0 ? it.nosQty * r.qty / it.qty : r.nosQty;
  });
  // A ref that bills the line whole closes it: what is billed is the line, or more if the parts say so.
  if (whole) { qty = Math.max(qty, Number(it.qty) || 0); nos = Math.max(nos, Number(it.nosQty) || 0); }
  return { qty: parseFloat(qty.toFixed(3)), nos: Math.round(nos) };
}

/* Write the derived billing onto every challan line. Returns how many changed. */
function imSyncBilled() {
  var idx = imBilledIndex(), held = {}, changed = 0;
  (S.invoices || []).forEach(function(inv) { held[inv.id] = true; });
  (S.incomingMaterial || []).forEach(function(im) {
    (im.items || []).forEach(function(it) {
      var before = JSON.stringify([it.invoiced, it.invoiceId, it.billedQty, it.billedNos, it.invoiceIds, it.billedLegacy]);
      var refs = idx[it.id] || [];
      if (!refs.length && it.invoiced && it.invoiceId && held[it.invoiceId] && (it.billedLegacy || it.billedQty == null)) {
        it.billedLegacy = true;
        it.invoiced = true;
        it.billedQty = Number(it.qty) || 0;
        if (it.nosQty) it.billedNos = it.nosQty; else delete it.billedNos;
        it.invoiceIds = [it.invoiceId];
      } else {
        delete it.billedLegacy;
        if (!refs.length) {
          it.invoiced = false; it.invoiceId = null;
          delete it.billedQty; delete it.billedNos; delete it.invoiceIds;
        } else {
          var b = imRefsBilled(it, refs), ids = [];
          refs.forEach(function(r) { if (ids.indexOf(r.invoiceId) < 0) ids.push(r.invoiceId); });
          it.billedQty = b.qty;
          if (b.nos > 0) it.billedNos = b.nos; else delete it.billedNos;
          it.invoiceIds = ids;
          it.invoiceId = ids[ids.length - 1];
          it.invoiced = (it.qty || 0) - b.qty <= IM_QTY_EPS;
        }
      }
      if (JSON.stringify([it.invoiced, it.invoiceId, it.billedQty, it.billedNos, it.invoiceIds, it.billedLegacy]) !== before) changed++;
    });
  });
  return changed;
}

/* Has any of this line been billed? (The edit/delete lock.) */
function imLineBilled(it) { return !!it.invoiced || (it.billedQty || 0) > 0; }

/* The share of a challan line still to bill: quantity, pieces and amount.
   An unbilled amount anywhere in the app is this share, never the whole line. */
function imLineOpen(it) {
  var q = Number(it.qty) || 0;
  if (it.invoiced) return { qty: 0, nos: 0, amount: 0 };
  var billed = Number(it.billedQty) || 0;
  var left = q - billed;
  if (left <= IM_QTY_EPS) left = 0;
  left = parseFloat(left.toFixed(3));
  if (!billed) return { qty: q, nos: Number(it.nosQty) || 0, amount: Number(it.amount) || 0 };
  var nos = 0;
  if (it.nosQty) nos = it.billedNos > 0 ? Math.max(0, it.nosQty - it.billedNos) : Math.round(it.nosQty * left / (q || 1));
  var amount = q > 0 ? gstRound((Number(it.amount) || 0) * left / q) : 0;
  return { qty: left, nos: nos, amount: amount };
}

/* One challan line against the invoices, leaving one invoice out (the one being
   edited: its own share is still available to it). */
function imLineShare(itemId, exceptInvoiceId, idx) {
  var im = null, it = null;
  (S.incomingMaterial || []).some(function(m) {
    var hit = (m.items || []).find(function(x) { return x.id === itemId; });
    if (hit) { im = m; it = hit; return true; }
    return false;
  });
  if (!it) return null;
  var refs = ((idx || imBilledIndex())[itemId] || []).filter(function(r) { return r.invoiceId !== exceptInvoiceId; });
  var billed = imRefsBilled(it, refs);
  if (!refs.length && it.billedLegacy && it.invoiceId !== exceptInvoiceId) {
    var legacy = S.invoices.find(function(i) { return i.id === it.invoiceId; });
    if (legacy) { refs = [{ invoiceId: legacy.id, displayNumber: legacy.displayNumber, qty: it.qty || 0 }]; billed = { qty: it.qty || 0, nos: it.nosQty || 0 }; }
  }
  var left = (Number(it.qty) || 0) - billed.qty;
  if (Math.abs(left) <= IM_QTY_EPS) left = 0;
  return { im: im, it: it, refs: refs, qty: Number(it.qty) || 0, billed: billed.qty, billedNos: billed.nos, left: parseFloat(left.toFixed(3)) };
}

/* "600 on challan 301 · 200 invoiced (SEP/…/00012) · 400 left" */
function imShareText(sh) {
  var ch = 'challan ' + (sh.im.challanNo || '(no number)');
  var unit = sh.it.unit === 'KG' ? ' kg' : '';
  return imQtyText(sh.qty) + unit + ' on ' + ch +
    (sh.refs.length ? ' · ' + imQtyText(sh.billed) + unit + ' invoiced (' + sh.refs.map(function(r) { return r.displayNumber; })
      .filter(function(v, i, a) { return a.indexOf(v) === i; }).join(', ') + ')' : '') +
    ' · ' + imQtyText(Math.max(0, sh.left)) + unit + ' left';
}

/* A challan line as an invoice line: at what is LEFT of it, linked by imItemId.
   The amount is the open share of the challan's own amount (for a line whose
   amount is its quantity × rate that is the same figure; for a piece client's
   passthrough amount it is the only one). The quantity stays editable. */
function imLineFormItem(it) {
  var open = imLineOpen(it), part = imLineBilled(it);
  return { partNumber: it.partNumber, desc: it.desc, hsn: it.hsn || '998873', unit: it.unit, qty: open.qty,
    rate: it.rate || 0, amount: open.amount, nosQty: (part ? open.nos : it.nosQty) || null,
    _override: false, _label: '', _imItemId: it.id, _nosAuto: !!(it.unit === 'KG' && it.nosQty), _fromNew: true, _orig: imLineOrig(it, open) };
}
/* What a challan line said as it was brought into a new invoice: a field typed over it is a correction to carry back
   (backCorrectChallans), the owner's ruling of 30 Sep 2026 — "correction on the invoice should be reflected in the
   challan with a note". The quantity is the share brought (what is left), so typing less is dispatching part of it. */
function imLineOrig(it, open) {
  var o = {};
  CHALLAN_SYNC_FIELDS.forEach(function(f) { o[f] = it[f] == null ? null : it[f]; });
  o.qty = open.qty; o.amount = open.amount; o.nosQty = (imLineBilled(it) ? open.nos : it.nosQty) || null;
  return o;
}

function getIMStatus(im) {
  const total = im.items.length;
  const invoicedCount = im.items.filter(it => it.invoiced).length;
  const touched = im.items.filter(imLineBilled).length;
  if (touched === 0) return 'pending';
  if (invoicedCount < total) return 'partial';
  return 'invoiced';
}

function getFilteredIM() {
  var month = _imTab === 'invoiced' ? imMonthShown() : null;
  let list = (S.incomingMaterial || []).filter(function(im) {
    if (_imTab !== 'invoiced') return !imIsBilled(im);
    return imIsBilled(im) && String(im.challanDate || '').slice(0, 7) === month;
  });
  if (_imFilter.clientId) {
    const cid = parseInt(_imFilter.clientId);
    list = list.filter(im => im.clientId === cid);
  }
  if (_imFilter.status) {
    list = list.filter(im => getIMStatus(im) === _imFilter.status);
  }
  // Sort: desktop uses multi-column, mobile uses pending-first + date desc
  if (_isDesktop) {
    var sc = getIMSortConfig();
    if (sc) {
      var dir = sc.dir === 'asc' ? 1 : -1;
      list.sort(function(a, b) {
        var va, vb;
        switch (sc.col) {
          case 'client': va = (a.clientName || '').toLowerCase(); vb = (b.clientName || '').toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0;
          case 'date': va = a.challanDate || ''; vb = b.challanDate || ''; return va < vb ? -dir : va > vb ? dir : 0;
          case 'items': return dir * (a.items.length - b.items.length);
          case 'amount': {
            return dir * (imShownAmount(a) - imShownAmount(b));
          }
          case 'status': {
            var so = { pending: 0, partial: 1, invoiced: 2 };
            va = so[getIMStatus(a)] || 0;
            vb = so[getIMStatus(b)] || 0;
            return dir * (va - vb);
          }
          default: va = a.challanDate || ''; vb = b.challanDate || ''; return va < vb ? -dir : va > vb ? dir : 0;
        }
      });
      return list;
    }
  }
  // The default, both layouts: newest challan first. (It also put invoiced challans last; each tab holds one kind.)
  list.sort(function(a, b) {
    return (b.challanDate || '').localeCompare(a.challanDate || '') || (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}

function renderIMToolbar() {
  const area = document.getElementById('imToolbar');
  if (!area) return;
  const clientIds = [...new Set((S.incomingMaterial || []).map(im => im.clientId))];
  const clientOpts = clientIds.map(cid => {
    const c = S.clients.find(x => x.id === cid);
    return c ? '<option value="' + cid + '"' + (_imFilter.clientId == cid ? ' selected' : '') + '>' + escHtml(c.name) + '</option>' : '';
  }).join('');
  var opt = function(v, label) { return '<option value="' + v + '"' + ((_imFilter.status || '') === v ? ' selected' : '') + '>' + label + '</option>'; };

  const dupeCount = imDuplicateGroupCount();

  // The filters speak through change (events.js), never click: a click that re-rendered
  // the toolbar replaced the element the native list hangs off, and it shut unpicked.
  // Invoiced holds one status, so its status filter would only ever offer itself.
  // One row (the tab map, TM5b): the filters (inline on the desktop, behind Filter on the phone, said under the row as tokens), Add
  // challan the one primary, Scan the one secondary, and the duplicate check behind More with its count.
  var filters = '<select class="inv-select inv-toolbar-item" id="imClientFilter" aria-label="Filter by client">' +
    '<option value="">All clients</option>' + clientOpts + '</select>' +
    (_imTab === 'invoiced' ? '' : '<select class="inv-select inv-toolbar-item" id="imStatusFilter" aria-label="Filter by status">' +
    opt('', 'All statuses') + opt('pending', 'Pending') + opt('partial', 'Part invoiced') + '</select>');
  var client = _imFilter.clientId ? S.clients.find(function(c) { return String(c.id) === String(_imFilter.clientId); }) : null;
  area.innerHTML = imViewTabsHtml() + '<div id="imVerdict">' + imVerdictHtml() + '</div>' + '<div class="inv-toolbar" data-im-toolbar>' +
    uiFilterHtml({ key: 'im', count: (_imFilter.clientId ? 1 : 0) + (_imTab !== 'invoiced' && _imFilter.status ? 1 : 0), controls: filters }) +
    '<button class="inv-btn inv-btn-primary" data-action="invShowAddChallan">Add challan</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invScanChallan">' + ICON_CAMERA + 'Scan</button>' +
    uiToolbarMoreHtml([{ label: 'Duplicate check', action: 'invRunDupeScan', attrs: ' id="imDupeCheck"', badge: dupeCount ? { n: dupeCount, tone: 'warning' } : null }], { icon: !_isDesktop }) +
    '</div>' + uiTokensHtml([{ key: 'Client', value: client ? client.name : '', action: 'invIMFilterClear', attrs: ' data-clear="client"' },
      { key: 'Status', value: _imTab !== 'invoiced' && _imFilter.status ? (IM_STATUS_UI[_imFilter.status] || {}).word : '', action: 'invIMFilterClear', attrs: ' data-clear="status"' }]) +
    (_imTab === 'invoiced' ? imMonthPagerHtml() : '');
  viewTabReveal(area.querySelector('.inv-viewtabs'));
}
UI_FILTER_DONE.im = function() { renderIMToolbar(); _renderIMView(); };
/* A filter's token tapped: that filter cleared, the selection it made dropped (captureIMFilters' rule). */
function imFilterClear(which) {
  if (which === 'client') _imFilter.clientId = ''; else _imFilter.status = '';
  _imSelected = {};
  renderIMToolbar();
  _renderIMView();
}

/* How long a challan has waited on its invoice, judged (the tab map, TM5b): amber from the To-do's challan days (Settings →
   Checks & alerts → To-do, 5), red from twice that. The challan's dot, Pipeline's first stage and the To-do's challan task read it,
   so the three agree at any age. */
function imWaitTone(days) {
  var d = (typeof todoCfg === 'function' && todoCfg().challanDays) || 5;
  return days == null ? 'neutral' : days >= d * 2 ? 'danger' : days >= d ? 'warning' : 'neutral';
}
function imWaitDays(im) { return im && im.challanDate ? Math.max(0, isoDaysBetween(im.challanDate, localDateStr())) : null; }
/* Awaiting invoice's verdict (the tab map, TM5b; it was the page-head line): how many challans wait and what they bill, in the
   tone of the oldest, its days the card's figure. Invoiced has the month's stepper. */
function imVerdictHtml() {
  if (_imTab === 'invoiced') return '';
  var list = getFilteredIM(), open = gstRound(list.reduce(function(t, im) { return t + imChallanOpenTotal(im); }, 0));
  var ages = list.map(imWaitDays).filter(function(a) { return a != null; }), oldest = ages.length ? Math.max.apply(null, ages) : null;
  var d = todoCfg().challanDays || 5, late = ages.filter(function(a) { return a >= d; }).length, part = list.filter(imPartInvoiced).length;
  var filtered = !!(_imFilter.clientId || _imFilter.status);
  if (!list.length) return uiVerdictHtml({ screen: 'Awaiting invoice', tone: 'ok', verdict: filtered ? 'Nothing awaiting invoice for this filter' : 'Nothing awaiting invoice', key: 'pageIM-awaiting' });
  return uiVerdictHtml({ screen: 'Awaiting invoice' + (filtered ? ' · filtered' : ''), tone: imWaitTone(oldest),
    verdict: todoPlural(list.length, 'challan') + ' waiting · ' + finRs(open) + ' to bill',
    fig: oldest != null ? escHtml(String(oldest)) + '<span class="inv-unit">d</span>' : '',
    facts: [oldest != null ? { text: 'days the oldest has waited', tone: imWaitTone(oldest) === 'neutral' ? '' : imWaitTone(oldest) } : 'no challan date',
      late ? { text: late + ' over ' + pipeDays(d), tone: ages.some(function(a) { return a >= d * 2; }) ? 'danger' : 'warning' } : '',
      part ? todoPlural(part, 'part invoiced', 'part invoiced') : ''],
    key: 'pageIM-awaiting', attrs: ' data-im-summary="' + list.length + '"' });
}

/* A selection belongs to the list it was made on. A jump that opens IM on one client — History's, Stats', the duplicate
   check's Locate — changes the filter without passing captureIMFilters, and the ticks it hid stayed live for Create
   invoice. Whatever changed the view (tab, month, client, status), the selection made on the old one is dropped. */
var _imSelView = null;
function imSelectionGuard() {
  var k = [_imTab, _imTab === 'invoiced' ? imMonthShown() : '', _imFilter.clientId || '', _imFilter.status || ''].join('|');
  if (_imSelView !== null && _imSelView !== k) _imSelected = {};
  _imSelView = k;
}

function renderIMList() {
  const area = document.getElementById('imList');
  if (!area) return;
  imSelectionGuard();
  const filtered = getFilteredIM();
  let html = '';

  if (filtered.length === 0) {
    html += '<div class="inv-panel"><div class="inv-empty">' + (_imTab === 'invoiced' ? 'No challan invoiced' : 'Nothing awaiting invoice') + (_imFilter.clientId || _imFilter.status ? ' for this filter' : '') + '</div></div>';
  } else {
    // Grouped by challan date with the day's value (§7): the tab says whether it is billed.
    // Awaiting invoice's count and amount are its verdict's (imVerdictHtml): its list carries no head of its own.
    (function(list) {
      html += '<div class="inv-panel inv-panel-flush">' + (_imTab === 'invoiced' ? '<div class="inv-panel-head"><span class="inv-panel-title">Invoiced' +
        ' <span class="inv-panel-count">' + list.length + '</span></span></div>' : '');
      // The first thirty challans; the rest one tap away (UX overhaul 2, step 6: a month of billed challans ran 7.5 screens).
      var day = null, imRows = [];
      list.forEach(function(im, idx) {
        if (im.challanDate !== day) {
          day = im.challanDate;
          var same = list.filter(function(x) { return x.challanDate === day; });
          imRows.push({ head: true, parts: ['<div class="inv-row-group"><span>' + (day ? escHtml(formatDate(day)) : 'No date') + ' · ' + same.length + '</span>' +
            '<span class="inv-num">' + formatCurrency(gstRound(same.reduce(function(s, x) { return s + imShownAmount(x); }, 0))) + '</span></div>'] });
        }
        var status = getIMStatus(im), expanded = !!_imExpanded[im.id];
        var pendingItems = im.items.filter(function(it) { return !it.invoiced; });
        var allChecked = pendingItems.length > 0 && pendingItems.every(function(it) { return _imSelected[it.id]; });
        var id = escHtml(im.id);
        var parts = [];
        parts.push('<div class="inv-row inv-row-2' + (allChecked ? ' inv-row-selected' : '') + '" data-im="' + id + '">' +
          (status !== 'invoiced' ? '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCheckIMChallan" data-id="' + id + '"' +
            (allChecked ? ' checked' : '') + ' aria-label="Select all of ' + escHtml(imChallanLabel(im)) + '"></label>' : '') +
          '<button class="inv-row-main inv-row-expander" data-action="invToggleIM" data-id="' + id + '" aria-expanded="' + expanded + '">' +
          imRowMainHtml(im) + '</button>' + imRowEndHtml(im) + '</div>');
        if (expanded) {
          var kids = '<div class="inv-row-children">' + im.items.map(_imItemRowHtml).join('');
          var acts = _imActionsHtml(im, false);
          if (acts) kids += '<div class="inv-row inv-row-auto"><span class="inv-toolbar inv-toolbar-tight">' + acts + '</span></div>';
          parts.push(kids + '</div>');
        }
        imRows.push({ parts: parts });
      });
      html += uiMoreHtml('im-list-' + _imTab, imRows, { noun: 'challans' });
      html += '</div>';
    })(filtered);
  }
  area.innerHTML = html;
  renderIMSelBar();
}

function renderIMSelBar() {
  const bar = document.getElementById('imSelBar');
  if (!bar) return;
  const selectedIds = Object.keys(_imSelected).filter(k => _imSelected[k]);
  if (selectedIds.length === 0) { bar.innerHTML = ''; return; }
  let total = 0;
  const clientIds = new Set();
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) { total += imLineOpen(it).amount; clientIds.add(im.clientId); }
    });
  });
  // An invoice is addressed to one customer: a two-client selection says so on the button.
  const multiClient = clientIds.size > 1;
  bar.innerHTML = '<div class="inv-selbar">' +
    '<span class="inv-selbar-count">' + selectedIds.length + ' item' + (selectedIds.length > 1 ? 's' : '') + '</span>' +
    '<span class="inv-selbar-sum">' + formatCurrency(total) + '</span>' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invCreateFromIM"' + (multiClient ? ' disabled title="Select items from one client only"' : '') + '>' +
    (multiClient ? 'Two clients selected' : 'Create invoice') + '</button></div>';
}

/* ===== IM DESKTOP TABLE (Phase 8D) ===== */

/* ===== IM DESKTOP TABLE ===== */
function _buildIMTableHtml() {
  var filtered = getFilteredIM();
  var html = '';
  if (filtered.length === 0) return html + '<div class="inv-empty">' + (_imTab === 'invoiced' ? 'No challan invoiced' : 'Nothing awaiting invoice') + (_imFilter.clientId || _imFilter.status ? ' for this filter' : '') + '</div>';

  var sc = getIMSortConfig();
  var th = function(key, label, cls) {
    var on = sc && sc.col === key;
    return '<th class="' + (cls || '') + '"' + (on ? ' aria-sort="' + (sc.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
      '<button class="inv-table-sort" data-action="invDesktopIMSort" data-col="' + key + '">' + label +
      (on ? '<span aria-hidden="true">' + (sc.dir === 'asc' ? ' ▲' : ' ▼') + '</span>' : '') + '</button></th>';
  };
  html += '<table class="inv-table"><thead><tr>' +
    '<th class="inv-table-check"><span class="inv-visually-hidden">Select</span></th><th>Challan</th>' + th('client', 'Client', 'inv-col-grow') +
    th('date', 'Date', 'inv-col-opt3') + '<th class="inv-col-opt2">Vehicle</th>' + th('items', 'Items', 'inv-num inv-col-opt2') +
    th('amount', 'Amount', 'inv-num') + th('status', 'Status') + '</tr></thead><tbody>';

  filtered.forEach(function(im) {
    var status = getIMStatus(im), id = escHtml(im.id);
    var pendingItems = im.items.filter(function(it) { return !it.invoiced; });
    var allChecked = pendingItems.length > 0 && pendingItems.every(function(it) { return _imSelected[it.id]; });
    html += '<tr class="' + (allChecked ? 'inv-row-selected' : '') + '"' + (_imActiveChallanId === im.id ? ' aria-current="true"' : '') +
      ' data-id="' + id + '" data-im="' + id + '" data-action="invSelectIMRow">' +
      '<td class="inv-table-check">' + (status !== 'invoiced' ? '<input type="checkbox" class="inv-check" data-action="invCheckIMChallan" data-id="' + id + '"' +
        (allChecked ? ' checked' : '') + ' aria-label="Select all of ' + escHtml(imChallanLabel(im)) + '">' : '') + '</td>' +
      // The challan number is a real button, so the row opens from the keyboard.
      '<td><button class="inv-btn-link inv-id" data-action="invSelectIMRow" data-id="' + id + '">' + (im.challanNo ? escHtml(im.challanNo) : '—') + '</button></td>' +
      '<td class="inv-col-grow" title="' + escHtml(im.clientName) + '">' + escHtml(im.clientName) + '</td>' +
      '<td class="inv-id inv-col-opt3">' + escHtml(formatDate(im.challanDate)) + '</td>' +
      '<td class="inv-id inv-col-opt2">' + escHtml(im.vehicleNo || '') + '</td>' +
      '<td class="inv-num inv-col-opt2">' + im.items.length + '</td>' +
      '<td class="inv-num"><span class="inv-row-stack">' + imAmountHtml(im) + '</span></td>' +
      '<td>' + imStatusDotHtml(im) + ' ' + flowPriorityBadgeHtml(im) + '</td></tr>';
  });
  return html + '</tbody></table>';
}

/* Render challan detail inline in #imDetail */
function _renderIMDetail(challanId, skipMasterRefresh) {
  var focusKey = skipMasterRefresh ? null : _mdFocusKey('imMasterDetail', _imActiveChallanId);
  var im = challanId ? (S.incomingMaterial || []).find(function(m) { return m.id === challanId; }) : null;
  _imActiveChallanId = im ? challanId : null;
  // The pane takes room only while a challan is open (§6.14), as the Register's does.
  var wrap = document.getElementById('imMasterDetail');
  if (wrap) wrap.classList.toggle('inv-pane-open', !!im);
  var detailEl = document.getElementById('imDetail');
  if (detailEl) detailEl.innerHTML = im ? paneHeadHtml('<span class="inv-panel-title inv-id">' + escHtml(imChallanLabel(im)) + '</span>', 'invIMClosePane') + challanDetailHtml(im) : '';
  if (!skipMasterRefresh) {
    var masterEl = document.getElementById('imMaster');
    if (masterEl) masterEl.innerHTML = _buildIMTableHtml();
    _mdRestoreFocus(focusKey, 'invSelectIMRow', 'invIMClosePane');
  }
}

function renderIMTable() {
  var area = document.getElementById('imList');
  if (!area) return;

  if (!_imToolbarRendered) {
    renderIMToolbar();
    _imToolbarRendered = true;
  }

  if (!document.getElementById('imMasterDetail')) {
    area.innerHTML =
      '<div class="inv-pane-host" id="imMasterDetail">' +
        '<div class="inv-pane-list" id="imMaster"></div>' +
        '<div class="inv-pane" id="imDetail"></div>' +
      '</div>';
  }

  var master = document.getElementById('imMaster');
  if (!master) return;
  imSelectionGuard();
  var focusKey = _mdFocusKey('imMasterDetail', _imActiveChallanId);
  master.innerHTML = _buildIMTableHtml();

  // Keep the pane in step with the data: a deleted or filtered-out challan closes it.
  if (_imActiveChallanId) {
    var visible = getFilteredIM().some(function(m) { return m.id === _imActiveChallanId; });
    _renderIMDetail(visible ? _imActiveChallanId : null, true);
  } else {
    _renderIMDetail(null, true);
  }
  _mdRestoreFocus(focusKey, 'invSelectIMRow', 'invIMClosePane');

  renderIMSelBar();
}

function imStatusDotHtml(im) {
  var st = getIMStatus(im), s = IM_STATUS_UI[st] || { word: st, tone: 'neutral' };
  // A challan waiting is toned by how long it has waited (imWaitTone); one invoiced whole is done.
  var tone = st === 'invoiced' ? s.tone : imWaitTone(imWaitDays(im));
  if (tone === 'neutral' && st === 'partial') tone = 'info';
  return '<span class="inv-dot inv-dot-' + tone + '"' + (st !== 'invoiced' && imWaitDays(im) != null ? ' title="' + escHtml(pipeDays(imWaitDays(im)) + ' waiting') + '"' : '') + '>' + escHtml(s.word) + '</span>';
}

function imChallanTotal(im) { return im.items.reduce(function(s, it) { return s + (Number(it.amount) || 0); }, 0); }
/* What a challan still has to bill: the open share of every line (owner, 30 Sep 2026: a part-invoiced challan showed the
   whole challan's amount under Awaiting invoice). */
function imChallanOpenTotal(im) { return gstRound(im.items.reduce(function(s, it) { return s + imLineOpen(it).amount; }, 0)); }
/* The amount a challan shows in a list: on Awaiting invoice what is left to bill, and on a part-invoiced challan the
   whole beside it; on Invoiced, the whole. */
function imShownAmount(im) { return _imTab === 'invoiced' || imIsBilled(im) ? imChallanTotal(im) : imChallanOpenTotal(im); }
function imPartInvoiced(im) { return !imIsBilled(im) && im.items.some(imLineBilled); }
/* `awaiting`: the amount as Awaiting invoice shows it (what is left to bill), whichever tab IM itself is on. */
function imAmountHtml(im, awaiting) {
  if ((awaiting != null ? awaiting : _imTab !== 'invoiced') && imPartInvoiced(im)) {
    return '<span class="inv-num" title="Left to bill, of ' + escHtml(formatCurrency(imChallanTotal(im))) + ' on the challan">' + formatCurrency(imChallanOpenTotal(im)) + '</span>' +
      '<span class="inv-row-meta" data-im-of>left of ' + formatCurrency(imChallanTotal(im)) + '</span>';
  }
  return '<span class="inv-num">' + formatCurrency(imChallanTotal(im)) + '</span>';
}
/* A challan's row as IM's list draws it: its number and client over its vehicle and lines, and its end, the amount over
   its status. Office → Pipeline's Awaiting list draws the same (pipeline.js), with the Awaiting amount. */
function imRowMainHtml(im) {
  // Two things in its meta (§3b-11): waiting, how long and how many items; billed, the vehicle and the items.
  var items = im.items.length + ' item' + (im.items.length !== 1 ? 's' : ''), age = imIsBilled(im) ? null : imWaitDays(im);
  var first = age != null ? (age === 0 ? 'received today' : pipeDays(age) + ' waiting') : im.vehicleNo ? escHtml(im.vehicleNo) : '';
  return '<span class="inv-row-title"><span class="inv-id">' + escHtml(imChallanLabel(im)) + '</span> · ' + escHtml(im.clientName) + ' ' + flowPriorityBadgeHtml(im) + '</span>' +
    '<span class="inv-row-meta">' + (first ? first + ' · ' : '') + items + '</span>';
}
function imRowEndHtml(im, awaiting) {
  return '<span class="inv-row-end"><span class="inv-row-stack">' + imAmountHtml(im, awaiting) + imStatusDotHtml(im) + '</span></span>';
}


/* A challan line. A line with anything left to bill carries its tick box; a billed
   share names the invoices it went on, each one a link that opens it. */
function _imItemRowHtml(it) {
  var lead = '', tag = '', share = '';
  if (!it.invoiced) {
    lead = '<label class="inv-row-lead inv-row-tick"><input type="checkbox" class="inv-check" data-action="invCheckIMItem" data-item-id="' + escHtml(it.id) + '"' +
      (_imSelected[it.id] ? ' checked' : '') + ' aria-label="Select ' + escHtml(lineLabel(it)) + '"></label>';
  }
  var ids = it.invoiceIds && it.invoiceIds.length ? it.invoiceIds : (it.invoiceId ? [it.invoiceId] : []);
  if (imLineBilled(it)) {
    tag = ids.map(function(iid) {
      var linked = S.invoices.find(function(iv) { return iv.id === iid; });
      return linked
        ? '<button class="inv-btn-link inv-id" data-action="invViewInvoiceDetail" data-id="' + escHtml(linked.id) + '" title="' + escHtml(linked.displayNumber) + '">Invoice ' + escHtml(linked.invoiceNumber || linked.displayNumber) + '</button>'
        : '<span class="inv-badge inv-badge-danger" title="Invoice deleted">Invoice missing</span>';
    }).join(' · ');
    if (!it.invoiced) {
      var open = imLineOpen(it), unit = it.unit === 'KG' ? ' kg' : '';
      share = '<span class="inv-row-meta inv-row-wrap" data-im-share><span class="inv-dot inv-dot-info">Part invoiced</span> ' +
        '<span>' + escHtml(imQtyText(it.billedQty)) + unit + ' billed · ' + escHtml(imQtyText(open.qty)) + unit + ' left</span></span>';
    }
  }
  return '<div class="inv-row inv-row-auto' + (it.invoiced ? ' inv-row-sub' : '') + '" data-im-item>' + lead +
    '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap" data-im-desc>' + escHtml(lineLabel(it)) + '</span>' +
    '<span class="inv-row-meta inv-row-wrap" data-im-detail>' + escHtml(it.qty) + ' ' + escHtml(it.unit) +
    (it.nosQty && it.nosQty > 0 ? ' (' + escHtml(it.nosQty) + ' NOS)' : '') +
    ' @ ' + formatCurrency(it.rate) + '/' + escHtml(it.unit) + '</span>' + share +
    (it.corrections || []).map(function(cx) {
      return '<span class="inv-row-meta inv-row-wrap" data-im-correction><span class="inv-dot inv-dot-info">Corrected</span> ' +
        escHtml(challanCorrectionText(it, cx) + ' · ' + formatDate(isoOf(new Date(cx.at)))) + '</span>';
    }).join('') + (tag ? '<span class="inv-row-meta inv-row-wrap" data-im-invoices>' + tag + '</span>' : '') + '</span>' +
    (imLineBilled(it) && !it.invoiced
      ? '<span class="inv-row-end"><span class="inv-row-stack"><span class="inv-num" title="Left to bill">' + formatCurrency(imLineOpen(it).amount) + '</span><span class="inv-row-meta">left of ' + formatCurrency(it.amount) + '</span></span></span></div>'
      : '<span class="inv-row-end inv-num">' + formatCurrency(it.amount) + '</span></div>');
}

/* Edit and delete while nothing on the challan is billed; once a line is, the edit says why not. */
function _imActionsHtml(im, primary) {
  var status = getIMStatus(im), billed = im.items.filter(imLineBilled).length, id = escHtml(im.id);
  // The day it is wanted by is set while anything on it is open, billed in part or not (flow.js).
  var wanted = status !== 'invoiced' ? '<button class="inv-btn inv-btn-ghost' + (primary ? '' : ' inv-btn-sm') + '" data-action="invFlowPrio" data-id="' + id + '">Wanted by</button>' : '';
  if (billed === 0) {
    // Secondary: the page's one primary is Add challan (DR-3).
    return '<button class="inv-btn inv-btn-secondary' + (primary ? '' : ' inv-btn-sm') + '" data-action="invEditChallan" data-id="' + id + '">Edit</button>' + wanted +
      '<button class="inv-btn inv-btn-danger' + (primary ? '' : ' inv-btn-sm') + '" data-action="invDeleteChallan" data-id="' + id + '">Delete challan</button>';
  }
  if (status !== 'invoiced') {
    // Shown as disabled, yet a tap or a click still says why: a button that took no pointer (inv-btn-disabled) told
    // only somebody on a keyboard.
    var why = 'Cannot edit: ' + billed + ' item' + (billed > 1 ? 's' : '') + ' already invoiced';
    return '<button class="inv-btn inv-btn-secondary' + (primary ? '' : ' inv-btn-sm') + '" aria-disabled="true" title="' + why + '" data-action="invEditChallanGuard" data-count="' + billed + '">Edit</button>' + wanted;
  }
  return '';
}

/* One challan read in full, in the desktop pane. */
function challanDetailHtml(im) {
  var h = '<div class="inv-kv inv-mb-8">' +
    '<div><div class="inv-kv-k">Challan</div><div class="inv-id">' + (im.challanNo ? escHtml(im.challanNo) : '—') + '</div></div>' +
    '<div><div class="inv-kv-k">Date</div><div class="inv-id">' + escHtml(formatDate(im.challanDate)) + '</div></div>' +
    '<div class="inv-kv-wide"><div class="inv-kv-k">Client</div><div>' + escHtml(im.clientName) + '</div></div>' +
    (im.vehicleNo ? '<div><div class="inv-kv-k">Vehicle</div><div class="inv-id">' + escHtml(im.vehicleNo) + '</div></div>' : '') +
    '<div><div class="inv-kv-k">Status</div><div>' + imStatusDotHtml(im) + '</div></div>' +
    (flowPriorityBadgeHtml(im) ? '<div><div class="inv-kv-k">Wanted by</div><div>' + flowPriorityBadgeHtml(im) + '</div></div>' : '') +
    (im.notes ? '<div class="inv-kv-wide"><div class="inv-kv-k">Notes</div><div>' + escHtml(im.notes) + '</div></div>' : '') +
    '</div>';
  h += '<div class="inv-panel inv-panel-flush"><div class="inv-row-group"><span>Lines · ' + im.items.length + '</span></div>' +
    im.items.map(_imItemRowHtml).join('') +
    '<div class="inv-row inv-row-strong"><span class="inv-row-main">Total</span><span class="inv-row-end inv-num">' + formatCurrency(imChallanTotal(im)) + '</span></div>' +
    (imPartInvoiced(im) ? '<div class="inv-row inv-row-strong" data-im-left><span class="inv-row-main">Left to bill</span><span class="inv-row-end inv-num">' + formatCurrency(imChallanOpenTotal(im)) + '</span></div>' : '') + '</div>';
  var acts = _imActionsHtml(im, true);
  return h + (acts ? '<div class="inv-toolbar">' + acts + '</div>' : '');
}

/* View dispatcher (Phase 8B) */
function _renderIMView() {
  _isDesktop ? renderIMTable() : renderIMList();
  // The verdict says what the list holds now (an invoice made, a filter changed); the rest of the toolbar stays as it is.
  var v = document.getElementById('imVerdict');
  if (v) v.innerHTML = imVerdictHtml();
}

function toggleIMExpand(imId) {
  _imExpanded[imId] = !_imExpanded[imId];
  _renderIMView();
}

/* Read the IM filters, and drop the selection they hide.
   Rows filtered off the screen stayed ticked, and Create Invoice From IM acts
   on the whole selection — so material the operator could no longer see went
   onto the invoice. Same shape as the register's, and the same fix. */
function captureIMFilters() {
  var icf = document.getElementById('imClientFilter');
  var isf = document.getElementById('imStatusFilter');
  if (icf) _imFilter.clientId = icf.value;
  if (isf) _imFilter.status = isf.value;
  _imSelected = {};
  _renderIMView();
}

function toggleIMItem(itemId) {
  _imSelected[itemId] = !_imSelected[itemId];
  if (!_imSelected[itemId]) delete _imSelected[itemId];
  _renderIMView();
}

function toggleIMChallan(imId) {
  const im = (S.incomingMaterial || []).find(m => m.id === imId);
  if (!im) return;
  const pendingItems = im.items.filter(it => !it.invoiced);
  const allChecked = pendingItems.every(it => _imSelected[it.id]);
  pendingItems.forEach(it => {
    if (allChecked) {
      delete _imSelected[it.id];
    } else {
      _imSelected[it.id] = true;
    }
  });
  _renderIMView();
}

function createInvoiceFromIM() {
  const selectedIds = Object.keys(_imSelected).filter(k => _imSelected[k]);
  if (selectedIds.length === 0) return;

  // Collect selected items and determine client
  const selectedItems = [];
  const linkedIMIds = new Set();
  const clientIds = new Set();
  let clientId = null;
  (S.incomingMaterial || []).forEach(im => {
    im.items.forEach(it => {
      if (_imSelected[it.id]) {
        selectedItems.push({ ...it, _imId: im.id, _challanNo: im.challanNo, _challanDate: im.challanDate, _vehicleNo: im.vehicleNo });
        linkedIMIds.add(im.id);
        clientIds.add(im.clientId);
        clientId = im.clientId;
      }
    });
  });

  /* An invoice is addressed to one customer. This used to take whichever
     challan happened to come last in the array — the loop above simply
     overwrote clientId — so a selection spanning two clients produced one
     invoice carrying both clients' material, billed to one of them and priced
     off that one's rate card. Reachable without any filter at all: the IM list
     defaults to All Clients, so two challans from two customers sit next to
     each other and both can be ticked. */
  if (clientIds.size > 1) {
    var names = Array.from(clientIds).map(function(cid) {
      var c = S.clients.find(function(x) { return x.id === cid; });
      return c ? c.name : ('client ' + cid);
    });
    showToast('One invoice, one customer — this selection spans ' + names.join(' and '), 'error');
    return;
  }

  if (!clientId) return;
  const client = S.clients.find(c => c.id === clientId);
  if (!client) return;

  // Build invoice form
  invoiceForm = {
    clientId: clientId,
    date: localDateStr(),
    // A line part-invoiced already comes in at what is left of it (imLineFormItem).
    items: selectedItems.map(imLineFormItem),
    poNumber: '', poDate: selectedItems[0]._challanDate || localDateStr(),
    challanNo: selectedItems.map(it => it._challanNo).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i).join(', '),
    challanDate: selectedItems[0]._challanDate || localDateStr(),
    despatchDate: localDateStr(), transport: selectedItems.map(it => it._vehicleNo).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i).join(', '), eWayBill: '',
    remarks: '',
    editingId: null,
    _linkedIMItemIds: selectedIds,
    _linkedIMIds: [...linkedIMIds]
  };

  // A piece client's share is priced off the challan's own amount, the share that completes a line taking what is left
  // of it, as the Create picker does (createPickChallan): brought in at the open share alone, the last third of ₹100.00
  // billed ₹33.33 and the line's invoices came to ₹99.99.
  if (client.billingMode === 'piece') invoiceForm.items.forEach(item => { if (item.unit === 'NOS') createPieceShare(item); });

  // The vehicle came from the challans, so it is still the app's: the client's own may replace it.
  invoiceForm._auto = { ve: invoiceForm.transport };
  createApplyClientDefaults();

  // Clear selection
  _imSelected = {};

  renderCreateForm();
  switchTab('pageCreate');
  showToast(selectedItems.length + ' item' + (selectedItems.length > 1 ? 's' : '') + ' loaded from incoming material');
}

