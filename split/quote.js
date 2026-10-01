/* ===== QUOTATIONS (Clients → Quotations) =====
   Owner, 1 Oct 2026: "a quotation generator". The register and its rules live in soma-internal
   (operations/quotations/README.md); this is the app's side of them, built to the register's own rules:

   - A row at issue, not at drafting. A DRAFT HOLDS NO NUMBER: its face says DRAFT and its number reads "Draft". The
     duplicate 001 in the register came from drafts that printed numbers. Issue takes the next number of the
     quotation's financial year (from its own date), highest issued in that year + 1, voids and superseded included:
     a number is never reused.
   - An issued quotation is never edited. Revise (a reason required) copies it as a draft carrying the same number,
     Rev + 1; issuing that supersedes the old one. A new price after negotiation is a revision too. Void (issued but
     never sent; a reason required) keeps the number with its reason. Accepted / Declined record the answer.
   - Two live prices for the same item let a counterparty anchor at the lower: issuing while another live quotation
     names the same recipient and item asks whether that one is superseded by this.
   - On acceptance the rate is OFFERED to the client's card, never posted unasked, and into the right field: a per-piece
     rate for a weight-billed client is an itemRates row, never a billingMode change (README § On conversion).
   - The recipient's registered spelling is confirmed against the recipient's own paper, not against this book.

   The document (qtDocHtml) is drawn from the record every time and printed through the one print view, on its own
   point scale (.inv-qt-doc), one A4 page: the terms' tail and the signature are kept together. */

var QT_INTRO = 'Further to our discussions, we are pleased to submit our rate for zinc electroplating of your components on job-work basis.';
var QT_STATUS = {
  draft: ['Draft', 'neutral'], issued: ['Live', 'info'], accepted: ['Accepted', 'ok'], declined: ['Declined', 'neutral'],
  superseded: ['Superseded', 'neutral'], void: ['Void', 'danger']
};
var QT_TRANSPORT = [['excluded', 'Excluded'], ['included', 'Included'], ['loading', 'Loading']];
var QT_TRANSPORT_WHY = { excluded: 'Ex-works: the customer brings and collects the material.', included: 'Pick-up and return delivery are to our account.',
  loading: 'Loading and unloading of the customer&rsquo;s vehicle at our works are included.' };
var QT_FILTERS = [['all', 'All quotations'], ['draft', 'Drafts'], ['issued', 'Live'], ['expired', 'Expired'], ['accepted', 'Accepted'],
  ['declined', 'Declined'], ['superseded', 'Superseded'], ['void', 'Void']];

var _qtForm = null;       // {q, termsAuto}: the form open as a sub-view of Clients → Quotations
var _qtActiveId = null;   // the quotation open in the desktop's pane
var _qtSearch = '';
var _qtStatus = 'all';

function getQuotations() {
  if (!S.quotations) S.quotations = [];
  return S.quotations;
}
function qtCfg() {
  var c = S.qtnCfg || (S.qtnCfg = {});
  return { signatory: c.signatory || '', signTitle: c.signTitle || '', footNote: c.footNote || '' };
}
function qtFind(id) { return getQuotations().find(function(q) { return q.id === id; }) || null; }
function qtUid() { return 'QT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function qtPad(n) { return String(n).padStart(3, '0'); }

/* ---------- The series ---------- */
/* The series' first token is the invoice prefix's ('SEP/2026-27/' → 'SEP'), as the credit note reads its year off it. */
function qtSeriesToken() {
  var parts = String(S.invPrefix || '').split('/').map(function(s) { return s.trim(); }).filter(Boolean);
  var tok = parts.find(function(p) { return seriesFyStart(p) == null && /[A-Za-z]/.test(p); });
  return tok || 'SEP';
}
/* The financial year a quotation dated `iso` belongs to, written the way the invoice prefix writes its own. */
function qtFyOf(iso) {
  var y = isoFyStart(iso || localDateStr());
  if (y == null) return '';
  var m = String(S.invPrefix || '').match(/(\d{4}|\d{2})\s*-\s*(\d{4}|\d{2})/);
  var a = m && m[1].length === 2 ? String(y % 100).padStart(2, '0') : String(y);
  var b = m && m[2].length === 4 ? String(y + 1) : String((y + 1) % 100).padStart(2, '0');
  return a + '-' + b;
}
function qtDisplay(fy, num, rev) {
  return qtSeriesToken() + '/QTN/' + fy + '/' + qtPad(num) + (rev ? ' Rev ' + rev : '');
}
/* "Draft" until issued: a draft holds no number. A revision carries its number from the start. */
function qtNumberText(q) { return q && q.num ? (q.displayNumber || qtDisplay(q.fy, q.num, q.rev)) : 'Draft'; }
/* The highest number taken in a year's series, by anything: issued, revised, superseded, void. */
function qtSeriesHighest(fy) {
  var hi = 0;
  getQuotations().forEach(function(q) { if (q.fy === fy && q.num > hi) hi = q.num; });
  return hi;
}
function qtNextNum(fy) { return qtSeriesHighest(fy) + 1; }

/* ---------- Reading a quotation ---------- */
function qtValidUntil(q) { return q.date && q.validDays > 0 ? isoAddDays(q.date, q.validDays) : null; }
function qtDaysLeft(q) { var u = qtValidUntil(q); return u ? isoDaysBetween(localDateStr(), u) : null; }
function qtExpired(q) { var d = qtDaysLeft(q); return d != null && d < 0; }
/* A live price: issued or accepted, not past its validity. */
function qtLive(q) { return (q.status === 'issued' || q.status === 'accepted') && !qtExpired(q); }
function qtStatusWord(q) {
  if (q.status === 'issued' && qtExpired(q)) return ['Expired', 'warning'];
  return QT_STATUS[q.status] || ['Draft', 'neutral'];
}
function qtDotHtml(q) { var w = qtStatusWord(q); return '<span class="inv-dot inv-dot-' + w[1] + '">' + w[0] + '</span>'; }
function qtRecipient(q) { return (q.to && q.to.name) || 'No recipient'; }
function qtItemKey(l) { return rateKey(l.partNumber || l.item); }
function qtRateText(l) { return formatCurrency(l.rate) + (l.basis === 'piece' ? '/pc' : '/kg'); }
function qtRateSummary(q) {
  var ls = (q.lines || []).filter(function(l) { return l.rate > 0; });
  return ls.length ? qtRateText(ls[0]) + (ls.length > 1 ? ' +' + (ls.length - 1) : '') : 'no rate';
}
function qtPerKg(l) { return l.basis === 'piece' && l.rate > 0 && l.refWeightKg > 0 ? gstRound(l.rate / l.refWeightKg) : null; }
function qtClient(q) { return q && q.clientId != null ? (S.clients || []).find(function(c) { return c.id === q.clientId; }) || null : null; }
function qtLongDate(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return iso || '';
  var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+p[1] - 1];
  return +p[2] + ' ' + (m || '') + ' ' + p[0];
}

/* ---------- The terms, from the form's options ---------- */
function qtTermsFor(q) {
  var lines = (q.lines || []).filter(function(l) { return l.item || l.partNumber; });
  var pc = lines.filter(function(l) { return l.basis === 'piece'; }).length, kg = lines.length - pc;
  var gst = 'GST @ ' + formatNum(q.gstPct, q.gstPct % 1 ? 1 : 0) + '% extra, as applicable' + (q.sac ? ' (SAC ' + q.sac + ')' : '') + '.';
  var t = [];
  t.push('Job work on material supplied under your delivery challan (GST job-work provisions); billing on ' +
    (pc && !kg ? 'the number of pieces received and returned plated' : kg && !pc ? 'actual received weight' : 'the basis stated against each item') + '.');
  if (q.transport === 'included') {
    t.push('Transportation is included in the above rate: pick-up of material and return delivery of plated components are to our account' +
      (q.minConsignmentKg > 0 ? ', for one pick-up and one return delivery per consignment of not less than ' + formatNum(q.minConsignmentKg, q.minConsignmentKg % 1 ? 2 : 0) +
        ' kg. Consignments below that weight, and additional or part-lot trips, are chargeable at actuals or subject to re-quotation.' : '.'));
  } else if (q.transport === 'loading') {
    t.push('The above rate is inclusive of loading and unloading of your vehicle at our works, both on receipt of material and on despatch of plated components.');
  } else {
    t.push('Transportation is excluded: material is to be delivered to and collected from our works (ex-works).');
  }
  t.push(gst);
  t.push('Any plating defect will be re-processed free of cost. No liability is accepted for base-material defects.');
  t.push('Material to be presented in a condition fit for pickling and plating. Rework of rusted, oiled or previously plated material is chargeable and will be quoted separately.');
  t.push('Short, damaged or rejected pieces are to be advised at the time of return; our liability in respect of any consignment is limited to the job-work charges billed on that consignment.');
  t.push('Payment: within ' + (q.paymentDays > 0 ? q.paymentDays : 15) + ' days of invoice.');
  t.push('This rate is specific to the item' + (lines.length === 1 ? '' : 's') + ' quoted above and does not vary the rates in force on our existing running items.');
  var w = lines.filter(function(l) { return l.basis === 'piece' && l.refWeightKg > 0; });
  if (w.length) {
    t.push('The rate is quoted against a reference weight of ' + w.map(function(l) {
      return formatNum(l.refWeightKg, qtWeightDp(l.refWeightKg)) + ' kg per piece' + (w.length > 1 ? ' (' + (l.item || l.partNumber) + ')' : '');
    }).join(', ') + '. Should the actual piece weight differ materially from this reference, the rate is subject to re-quotation.');
  }
  if (q.lotPcs > 0) t.push('The rate is quoted against a consignment of ' + formatNum(q.lotPcs, 0) + ' pieces. It is subject to review on any material change in sustained offtake, lot size or consignment size.');
  t.push('This quotation is valid for ' + (q.validDays > 0 ? q.validDays : 30) + ' days from the date above.');
  return t;
}
function qtWeightDp(w) { var s = String(w); var i = s.indexOf('.'); return i < 0 ? 0 : Math.min(4, s.length - i - 1); }

/* ---------- The document ---------- */
function qtDocHtml(q) {
  var co = S.company || {};
  var addr = [co.add1, co.add2, co.add3].map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
  var phone = [co.phone, co.mobile].map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
  var contact = [co.gstin ? 'GSTIN: ' + co.gstin : '', phone ? 'Ph: ' + phone : '', co.email || ''].filter(Boolean);
  var cfg = qtCfg(), to = q.to || {};
  var mark = q.status === 'draft' ? 'DRAFT &mdash; not issued' : q.status === 'void' ? 'VOID' + (q.voidReason ? ' &mdash; ' + escHtml(q.voidReason) : '')
    : q.status === 'superseded' ? 'SUPERSEDED' + (qtFind(q.supersededBy) ? ' by ' + escHtml(qtNumberText(qtFind(q.supersededBy))) : '') : '';
  var transportNote = q.transport === 'included' ? 'inclusive of transportation' : q.transport === 'loading' ? 'incl. loading &amp; unloading at our works' : 'ex-works';
  var name = String(to.name || '').trim();
  var h = '<div class="inv-qt-doc" data-qt-doc="' + escHtml(q.id || '') + '">' +
    (mark ? '<div class="inv-qt-mark" data-qt-mark>' + mark + '</div>' : '') +
    '<div class="inv-qt-head"><div><div class="inv-qt-co">' + escHtml(co.name || '') + '</div>' +
      '<div class="inv-qt-co-sub">' + escHtml(addr) + (contact.length ? '<br>' + contact.map(escHtml).join(' &middot; ') : '') + '</div></div>' +
      '<div class="inv-qt-type"><div class="inv-qt-type-t">QUOTATION</div>Zinc electroplating &mdash; job work</div></div>' +
    '<div class="inv-qt-meta"><div><b>Ref:</b> <span data-qt-ref>' + escHtml(qtNumberText(q)) + '</span></div><div><b>Date:</b> ' + escHtml(qtLongDate(q.date)) + '</div></div>' +
    '<div class="inv-qt-to"><div class="inv-qt-lbl">To</div><div class="inv-qt-to-body">' +
      (to.attn ? escHtml(to.attn) + '<br>' : '') +
      '<b data-qt-to-name>' + (name ? escHtml(/^m\/s\b/i.test(name) ? name : 'M/s ' + name) : '&nbsp;') + '</b>' +
      String(to.address || '').split('\n').map(function(x) { return x.trim(); }).filter(Boolean).map(function(x) { return '<br>' + escHtml(x); }).join('') +
      (to.gstin || to.state ? '<div class="inv-qt-sub">' + [to.gstin ? 'GSTIN: ' + escHtml(to.gstin) : '', to.state ? 'State: ' + escHtml(to.state) : ''].filter(Boolean).join(' &middot; ') + '</div>' : '') +
    '</div></div>' +
    '<p class="inv-qt-p">Dear Sir,</p><p class="inv-qt-p">' + escHtml(q.intro || '') + '</p>' +
    '<table class="inv-qt-table"><thead><tr><th>Sl.</th><th>Item</th><th>Basis</th><th class="inv-qt-n">Rate</th></tr></thead><tbody>';
  (q.lines || []).forEach(function(l, i) {
    var piece = l.basis === 'piece';
    h += '<tr><td>' + (i + 1) + '</td><td><b>' + escHtml(l.item || l.partNumber || '') + '</b>' +
      (l.partNumber && l.item ? '<div class="inv-qt-sub">Part no. ' + escHtml(l.partNumber) + '</div>' : '') +
      '<div class="inv-qt-sub">' + escHtml(l.desc || 'Zinc electroplating — job work') + '</div>' +
      (l.note ? '<div class="inv-qt-sub">' + escHtml(l.note) + '</div>' : '') + '</td>' +
      '<td>' + (piece ? 'Per piece' : 'Per kg of received weight') +
      (piece && l.refWeightKg > 0 ? '<div class="inv-qt-sub">reference weight <b>' + escHtml(formatNum(l.refWeightKg, qtWeightDp(l.refWeightKg))) + '&nbsp;kg/pc</b></div>' : '') +
      '<div class="inv-qt-sub"><b>' + transportNote + '</b></div></td>' +
      '<td class="inv-qt-n"><b>' + escHtml(formatCurrency(l.rate || 0).replace('₹', '₹ ')) + '</b><div class="inv-qt-sub">per ' + (piece ? 'piece' : 'kg') + ' + GST</div></td></tr>';
  });
  h += '<tr><td colspan="4" class="inv-qt-gst">Rate <b>+ GST @ ' + escHtml(formatNum(q.gstPct, q.gstPct % 1 ? 1 : 0)) + '%</b>' + (q.sac ? ' (SAC ' + escHtml(q.sac) + ')' : '') + '.</td></tr></tbody></table>' +
    '<div class="inv-qt-tail"><div class="inv-qt-h3">TERMS &amp; CONDITIONS</div><ol class="inv-qt-terms">' +
    (q.terms || []).filter(function(t) { return String(t || '').trim(); }).map(function(t) { return '<li>' + escHtml(t) + '</li>'; }).join('') + '</ol>' +
    '<div class="inv-qt-sig"><div class="inv-qt-foot">' + String(cfg.footNote || '').split('\n').map(escHtml).join('<br>') + '</div>' +
    '<div><div class="inv-qt-for">For ' + escHtml(co.name || '') + '</div><div class="inv-qt-line">' +
      escHtml([cfg.signatory, cfg.signTitle || (cfg.signatory ? '' : 'Authorised signatory')].filter(Boolean).join(' — ')) + '</div></div></div></div></div>';
  return h;
}
function qtPrint(id) {
  var q = qtFind(id);
  var body = document.getElementById('invPrintBody');
  if (!q || !body) return;
  body.innerHTML = qtDocHtml(q);
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = qtNumberText(q).replace(/\//g, '-') + ' - ' + qtRecipient(q);
}

/* ---------- The list ---------- */
function qtMatches(q) {
  if (_qtStatus === 'expired' ? !(q.status === 'issued' && qtExpired(q)) : _qtStatus !== 'all' && q.status !== _qtStatus) return false;
  var s = String(_qtSearch || '').trim().toLowerCase();
  if (!s) return true;
  return [qtNumberText(q), qtRecipient(q)].concat((q.lines || []).map(function(l) { return [l.item, l.partNumber, l.desc].join(' '); }))
    .join(' ').toLowerCase().indexOf(s) >= 0;
}
function qtSorted(list) {
  return list.slice().sort(function(a, b) { return String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0); });
}
function qtRowHtml(q) {
  var d = qtDaysLeft(q), lines = (q.lines || []).length;
  var meta = [formatDate(q.date), todoPlural(lines, 'item'), qtRateSummary(q)];
  if (q.status === 'issued' && d != null) meta.push(d < 0 ? 'expired' : 'expires in ' + d + ' d');
  var title = qtNumberText(q) + ' · ' + qtRecipient(q);
  return '<button class="inv-row inv-row-2' + (/^(superseded|void|declined)$/.test(q.status) ? ' inv-row-muted' : '') + '" data-action="invQtOpen" data-id="' + escHtml(q.id) + '"' +
    (_isDesktop && _qtActiveId === q.id ? ' aria-current="true"' : '') + '>' +
    '<span class="inv-row-main"><span class="inv-row-title" title="' + escHtml(title) + '">' + escHtml(title) + '</span>' +
    '<span class="inv-row-meta">' + escHtml(meta.join(' · ')) + '</span></span>' +
    '<span class="inv-row-end">' + qtDotHtml(q) + '</span></button>';
}
function qtListHtml() {
  var all = qtSorted(getQuotations().filter(qtMatches));
  if (!all.length) return '<div class="inv-panel"><div class="inv-empty">' + (getQuotations().length ? 'No quotation matches' : 'No quotation yet. New quotation drafts one: it takes a number only when it is issued.') + '</div></div>';
  var grp = function(list) { return list.map(qtRowHtml).join(''); };
  var drafts = all.filter(function(q) { return q.status === 'draft'; }), live = all.filter(function(q) { return q.status === 'issued'; }),
    acc = all.filter(function(q) { return q.status === 'accepted'; }), rest = all.filter(function(q) { return /^(superseded|declined|void)$/.test(q.status); });
  var h = '';
  [['Drafts', drafts], ['Live', live], ['Accepted', acc]].forEach(function(g) {
    if (g[1].length) h += '<div class="inv-panel inv-panel-flush" data-qt-group="' + g[0] + '"><div class="inv-panel-head"><span class="inv-panel-title">' + g[0] +
      ' <span class="inv-panel-count">' + g[1].length + '</span></span></div>' + grp(g[1]) + '</div>';
  });
  if (rest.length) h += uiFoldHtml('qt-closed', '<span class="inv-panel-title">Superseded, declined and void <span class="inv-panel-count">' + rest.length + '</span></span>',
    grp(rest), false, ' data-qt-group="closed"');
  return h;
}
function qtViewHtml() {
  if (_qtForm) return qtFormHtml();
  var opts = QT_FILTERS.map(function(f) { return '<option value="' + f[0] + '"' + (_qtStatus === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('');
  var tools = '<div class="inv-toolbar"><label class="inv-search">' + ICON_SEARCH +
    '<input type="search" id="qtSearch" value="' + escHtml(_qtSearch) + '" placeholder="Search quotations" autocomplete="off" aria-label="Search quotations"></label>' +
    '<select class="inv-select inv-toolbar-item" id="qtStatusFilter" aria-label="Status">' + opts + '</select>' +
    '<button class="inv-btn inv-btn-primary" data-action="invQtNew">New quotation</button></div>';
  var list = '<div id="qtList">' + qtListHtml() + '</div>';
  return tools + (_isDesktop
    ? '<div class="inv-pane-host" id="qtHost"><div class="inv-pane-list" id="qtMaster">' + list + '</div><div class="inv-pane" id="qtPane"></div></div>'
    : list);
}
function qtRenderList() {
  var el = document.getElementById('qtList');
  if (el) el.innerHTML = qtListHtml();
}
/* Drawn by renderClientsPage (items.js) under the view tabs. */
function qtRenderView(container, tabsHtml) {
  container.innerHTML = (_qtForm ? '' : tabsHtml) + qtViewHtml();
  if (!_qtForm && _isDesktop) qtShowPane(_qtActiveId && qtFind(_qtActiveId) ? _qtActiveId : null);
  if (_qtForm) qtFormAfter();
}

/* ---------- The detail ---------- */
function qtDetailBodyHtml(q) {
  var kv = function(k, v, wide) { return '<div' + (wide ? ' class="inv-kv-wide"' : '') + '><div class="inv-kv-k">' + k + '</div><div>' + v + '</div></div>'; };
  var u = qtValidUntil(q), d = qtDaysLeft(q), to = q.to || {}, c = qtClient(q);
  var h = '<div>' + qtDotHtml(q) + '</div><div class="inv-kv">' +
    kv('Number', '<span class="inv-id">' + escHtml(qtNumberText(q)) + '</span>') +
    kv('Date', escHtml(formatDate(q.date))) +
    (u ? kv('Valid until', escHtml(formatDate(u)) + (q.status === 'issued' && d != null ? ' · ' + (d < 0 ? 'expired' : d + ' d left') : '')) : '') +
    kv('Recipient', escHtml(qtRecipient(q)) + (to.attn ? '<br>' + escHtml(to.attn) : '') + (c ? '' : '<br><span class="inv-row-meta">Not in the book</span>'), true) +
    (to.gstin ? kv('GSTIN', '<span class="inv-id">' + escHtml(to.gstin) + '</span>') : '') +
    kv('Transport', escHtml({ excluded: 'Excluded (ex-works)', included: 'Included', loading: 'Loading at our works' }[q.transport] || 'Excluded') +
      (q.transport === 'included' && q.minConsignmentKg > 0 ? ' · min ' + escHtml(formatNum(q.minConsignmentKg, 0)) + ' kg' : '')) +
    kv('GST', escHtml(formatNum(q.gstPct, q.gstPct % 1 ? 1 : 0) + '%' + (q.sac ? ' · SAC ' + q.sac : ''))) +
    (q.revOf ? kv('Revision', 'Rev ' + escHtml(q.rev) + ' of ' + escHtml(qtNumberText(Object.assign({}, q, { rev: 0, displayNumber: qtDisplay(q.fy, q.num, 0) }))) + ' &mdash; ' + escHtml(q.revReason || ''), true) : '') +
    (q.status === 'superseded' ? kv('Superseded by', escHtml(qtFind(q.supersededBy) ? qtNumberText(qtFind(q.supersededBy)) : 'another quotation'), true) : '') +
    (q.status === 'void' ? kv('Void', escHtml(q.voidReason || ''), true) : '') +
    (q.acceptedAt ? kv('Accepted', escHtml(formatDate(isoOf(new Date(q.acceptedAt))))) : '') +
    (q.declinedAt ? kv('Declined', escHtml(formatDate(isoOf(new Date(q.declinedAt))))) : '') +
    '</div>';
  h += '<div class="inv-panel inv-panel-flush"><div class="inv-panel-head"><span class="inv-panel-title">Items <span class="inv-panel-count">' + (q.lines || []).length + '</span></span></div>' +
    (q.lines || []).map(function(l) {
      var pk = qtPerKg(l);
      var meta = [l.partNumber || '', l.basis === 'piece' ? 'per piece' : 'per kg', l.basis === 'piece' && l.refWeightKg > 0 ? formatNum(l.refWeightKg, qtWeightDp(l.refWeightKg)) + ' kg/pc' : '',
        pk != null ? formatCurrency(pk) + '/kg' : '', l.postedAt ? 'posted to the client (' + (l.postedTo || '') + ')' : ''].filter(Boolean).join(' · ');
      return '<div class="inv-row inv-row-2"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(l.item || l.partNumber || 'Item') + '</span>' +
        '<span class="inv-row-meta">' + escHtml(meta) + '</span></span><span class="inv-row-end inv-num">' + escHtml(qtRateText(l)) + '</span></div>';
    }).join('') + '</div>';
  return h;
}
/* What can be done, by state. In the desktop's pane every button is secondary: the page's one primary is New quotation. */
function qtActionsHtml(q, primary) {
  var b = function(act, label, prim) {
    return '<button class="inv-btn ' + (prim ? 'inv-btn-primary' : 'inv-btn-secondary') + '" data-action="' + act + '" data-id="' + escHtml(q.id) + '">' + label + '</button>';
  };
  var list;
  if (q.status === 'draft') list = [['invQtEdit', 'Edit'], ['invQtPrint', 'Preview'], ['invQtDelete', 'Delete'], ['invQtIssue', 'Issue']];
  else if (q.status === 'issued') list = [['invQtRevise', 'Revise'], ['invQtAccept', 'Accepted'], ['invQtDecline', 'Declined'], ['invQtVoid', 'Void'], ['invQtPrint', 'Print']];
  else {
    list = [['invQtPrint', 'Print']];
    if (q.status === 'accepted' && qtPostPlan(q).post.length) list.unshift(['invQtPost', 'Post the rate']);
  }
  // In a dialog the last is the primary in its foot (primary === 'foot'), the rest a toolbar above it (primary === 'body').
  if (primary === 'foot') return b(list[list.length - 1][0], list[list.length - 1][1], true);
  if (primary === 'body') list = list.slice(0, -1);
  return list.map(function(a) { return b(a[0], a[1], false); }).join('');
}
function qtShowPane(id) {
  var host = document.getElementById('qtHost'), pane = document.getElementById('qtPane');
  var q = id ? qtFind(id) : null;
  _qtActiveId = q ? q.id : null;
  if (host) host.classList.toggle('inv-pane-open', !!q);
  if (pane) pane.innerHTML = q ? paneHeadHtml('<span class="inv-panel-title">' + escHtml(qtNumberText(q)) + '</span>', 'invQtClosePane') +
    qtDetailBodyHtml(q) + '<div class="inv-toolbar">' + qtActionsHtml(q, false) + '</div>' : '';
  document.querySelectorAll('#qtList [data-action="invQtOpen"]').forEach(function(r) {
    if (r.dataset.id === _qtActiveId) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
  });
}
function qtDialogHtml(q) {
  return '<div class="inv-dialog" data-qt-detail="' + escHtml(q.id) + '">' + dialogHeadHtml(escHtml(qtNumberText(q)) + ' · ' + escHtml(qtRecipient(q))) +
    qtDetailBodyHtml(q) + (qtActionsHtml(q, 'body') ? '<div class="inv-toolbar">' + qtActionsHtml(q, 'body') + '</div>' : '') +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Close</button>' + qtActionsHtml(q, 'foot') + '</div></div>';
}
/* A quotation opens in the pane on the desktop and in a dialog on the phone; from elsewhere (a client), on its view. */
function qtOpen(id, go) {
  var q = qtFind(id);
  if (!q) return;
  if (go && (navPageOf() !== 'pageClients' || getItemsSubView() !== 'quotes')) {
    closeOverlay();
    _qtForm = null;
    setItemsSubView('quotes');
    if (navPageOf() !== 'pageClients') switchTab('pageClients'); else renderClientsPage();
    markSideActive('pageClients');
  }
  if (_isDesktop && document.getElementById('qtHost') && !document.querySelector('.inv-scrim-dialog')) { qtShowPane(id); return; }
  dialogOpen(qtDialogHtml(q), { dismiss: true });
}
/* After a change: the list, and wherever the quotation is open, redrawn on what it now is. */
function qtShown(id) {
  qtRenderList();
  var q = id && qtFind(id);
  if (_isDesktop && document.getElementById('qtHost')) qtShowPane(q ? id : null);
  var dlg = document.querySelector('[data-qt-detail]');
  if (dlg) {
    var shown = qtFind(dlg.dataset.qtDetail);
    if (shown) dialogOpen(qtDialogHtml(q && q.id !== shown.id ? q : shown), { dismiss: true, replace: true }); else closeOverlay();
  }
}

/* A client's quotations, as one panel on its detail. */
function qtClientPanelHtml(clientId) {
  var list = qtSorted(getQuotations().filter(function(q) { return q.clientId === clientId; }));
  if (!list.length) return '';
  return '<div class="inv-panel inv-panel-flush" data-card="clientQuotes"><div class="inv-panel-head"><span class="inv-panel-title">Quotations <span class="inv-panel-count">' + list.length + '</span></span></div>' +
    uiMoreHtml('qt-client-' + clientId, list.map(function(q) {
      return '<button class="inv-row inv-row-2" data-action="invQtOpen" data-go="1" data-id="' + escHtml(q.id) + '"><span class="inv-row-main"><span class="inv-row-title inv-id">' + escHtml(qtNumberText(q)) + '</span>' +
        '<span class="inv-row-meta">' + escHtml(formatDate(q.date) + ' · ' + qtRateSummary(q)) + '</span></span><span class="inv-row-end">' + qtDotHtml(q) + '</span></button>';
    }), { n: 5, noun: 'quotations' }) + '</div>';
}

/* ---------- The form ---------- */
function qtBlankLine() { return { item: '', partNumber: '', desc: '', basis: 'piece', rate: null, refWeightKg: null, note: '' }; }
function qtBlank() {
  return { id: null, num: null, fy: null, displayNumber: null, rev: 0, revOf: null, revReason: '', date: localDateStr(), clientId: null,
    to: { name: '', address: '', gstin: '', state: '', attn: '' }, intro: QT_INTRO, lines: [qtBlankLine()], gstPct: 18, sac: '998873',
    transport: 'excluded', minConsignmentKg: null, lotPcs: null, validDays: 30, paymentDays: 15, terms: [], status: 'draft' };
}
function qtCopy(q) { return JSON.parse(JSON.stringify(q)); }
function qtOpenForm(id) {
  var src = id ? qtFind(id) : null;
  if (src && src.status !== 'draft') { showToast('An issued quotation is never edited: revise it', 'warning'); return; }
  var q = src ? qtCopy(src) : qtBlank();
  // The terms follow the options until somebody edits one (a draft saved with edited terms keeps them).
  var auto = !src || JSON.stringify(src.terms || []) === JSON.stringify(qtTermsFor(src));
  if (!src || !(q.terms || []).length) { q.terms = qtTermsFor(q); auto = true; }
  _qtForm = { q: q, termsAuto: auto };
  closeOverlay();
  setItemsSubView('quotes');
  if (navPageOf() !== 'pageClients') switchTab('pageClients'); else renderClientsPage();
  viewTop();
}
function qtCloseForm() {
  _qtForm = null;
  _pageTyped = false;
  renderClientsPage();
  viewTop();
}
function _qtF(id, label, input, hint) {
  return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' + input + (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>';
}
function _qtIn(id, key, value, extra) {
  return '<input class="inv-input" id="' + id + '" data-qt-f="' + key + '" value="' + escHtml(value == null ? '' : value) + '"' + (extra || '') + '>';
}
function _qtNumIn(id, key, value, step) {
  return '<input class="inv-input inv-input-num" type="number" inputmode="decimal" min="0" step="' + (step || 'any') + '" id="' + id + '" data-qt-f="' + key + '" value="' + escHtml(value == null ? '' : value) + '">';
}
function qtLineInfo(i) {
  var f = _qtForm, l = f && f.q.lines[i];
  if (!l) return '';
  var bits = [], pk = qtPerKg(l), c = qtClient(f.q);
  if (pk != null) bits.push(formatCurrency(pk) + '/kg at ' + formatNum(l.refWeightKg, qtWeightDp(l.refWeightKg)) + ' kg/pc');
  if (c && (l.partNumber || l.basis === 'kg')) {
    var rr = getRateOnRecord(c, f.q.date, { partNumber: l.partNumber || '', unit: l.basis === 'piece' ? 'NOS' : 'KG', desc: l.desc || '' });
    if (rr && rr.rate != null) bits.push('on record for ' + c.name + ': ' + formatCurrency(rr.rate) + '/' + (rr.unit === 'piece' ? 'pc' : 'kg'));
  }
  return escHtml(bits.join(' · '));
}
function qtLineHtml(l, i, n) {
  var id = function(k) { return 'qtL' + i + k; };
  var lf = function(k) { return ' data-qt-line="' + i + '" data-qt-lf="' + k + '"'; };
  var seg = '<div class="inv-seg inv-seg-fit" role="group" aria-label="Basis">' + [['piece', 'Per piece'], ['kg', 'Per kg']].map(function(o) {
    return '<button type="button" class="inv-seg-btn" data-action="invQtBasis" data-i="' + i + '" data-v="' + o[0] + '" aria-pressed="' + (l.basis === o[0]) + '">' + o[1] + '</button>';
  }).join('') + '</div>';
  return '<div class="inv-panel" data-qt-line-card="' + i + '"><div class="inv-panel-head"><span class="inv-panel-title">Item ' + (i + 1) + '</span>' +
    (n > 1 ? '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invQtLineDel" data-i="' + i + '">Remove</button>' : '') + '</div>' +
    '<div class="inv-fields">' +
    _qtF(id('item'), 'Item', '<input class="inv-input" id="' + id('item') + '"' + lf('item') + ' value="' + escHtml(l.item) + '" placeholder="e.g. MOUNT REAR CORNER" autocomplete="off">') +
    _qtF(id('part'), 'Part no.', '<input class="inv-input inv-id" id="' + id('part') + '"' + lf('partNumber') + ' value="' + escHtml(l.partNumber) + '" autocomplete="off">') +
    '</div>' +
    _qtF(id('desc'), 'Description', '<input class="inv-input" id="' + id('desc') + '"' + lf('desc') + ' value="' + escHtml(l.desc) + '" placeholder="Zinc electroplating — job work" autocomplete="off">') +
    '<div class="inv-field"><span class="inv-field-label">Basis</span>' + seg + '</div>' +
    '<div class="inv-fields">' +
    _qtF(id('rate'), l.basis === 'piece' ? 'Rate, ₹ per piece' : 'Rate, ₹ per kg', '<input class="inv-input inv-input-num" type="number" inputmode="decimal" min="0" step="any" id="' + id('rate') + '"' + lf('rate') + ' value="' + escHtml(l.rate == null ? '' : l.rate) + '">') +
    (l.basis === 'piece' ? _qtF(id('wt'), 'Reference weight, kg/pc', '<input class="inv-input inv-input-num" type="number" inputmode="decimal" min="0" step="any" id="' + id('wt') + '"' + lf('refWeightKg') + ' value="' + escHtml(l.refWeightKg == null ? '' : l.refWeightKg) + '">') : '') +
    '</div>' +
    '<div class="inv-field-hint" id="qtLineInfo' + i + '">' + qtLineInfo(i) + '</div>' +
    _qtF(id('note'), 'Note', '<input class="inv-input" id="' + id('note') + '"' + lf('note') + ' value="' + escHtml(l.note) + '" autocomplete="off">') +
    '</div>';
}
function qtTermsHtml() {
  var f = _qtForm;
  return (f.q.terms || []).map(function(t, i) {
    return '<div class="inv-field"><label class="inv-field-label" for="qtTerm' + i + '">Term ' + (i + 1) + '</label>' +
      '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><textarea class="inv-textarea inv-toolbar-item" rows="2" id="qtTerm' + i + '" data-qt-term="' + i + '">' + escHtml(t) + '</textarea>' +
      '<button class="inv-btn inv-btn-icon inv-btn-ghost" data-action="invQtTermDel" data-i="' + i + '" aria-label="Remove term ' + (i + 1) + '">&times;</button></div></div>';
  }).join('') + '<div class="inv-field-hint">' + (f.termsAuto ? 'Written from the options above, and rewritten when they change, until a term is edited.' : 'Edited by hand: the options no longer rewrite them.') + '</div>';
}
function qtFormHtml() {
  var f = _qtForm, q = f.q, to = q.to;
  var clients = (S.clients || []).slice().sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
  var h = '<div class="inv-pagehead"><button class="inv-btn inv-btn-ghost inv-btn-sm inv-pagehead-back" data-action="invQtBack">' + STOCK_BACK_ICON + 'Quotations</button>' +
    '<h2 class="inv-pagehead-title">' + escHtml(q.revOf ? 'Revise ' + qtNumberText(q) : q.id ? 'Edit draft' : 'New quotation') + '</h2></div>';
  if (q.revOf) h += '<div class="inv-callout inv-callout-info">A revision of ' + escHtml(qtNumberText(Object.assign({}, q, { rev: 0, displayNumber: qtDisplay(q.fy, q.num, 0) }))) +
    ' (' + escHtml(q.revReason || '') + '). Issuing it supersedes the one it revises; until then that one stands.</div>';
  else h += '<div class="inv-callout inv-callout-neutral">A draft holds no number. It takes the next number of its financial year when it is issued.</div>';
  h += '<div class="inv-panel"><div class="inv-fields">' +
    _qtF('qtDate', 'Date', '<input type="date" class="inv-input" id="qtDate" data-qt-f="date" value="' + escHtml(q.date) + '">') +
    _qtF('qtClient', 'Recipient', '<select class="inv-select" id="qtClient" data-qt-f="clientId"><option value="">Not in the book: type it below</option>' +
      clients.map(function(c) { return '<option value="' + escHtml(String(c.id)) + '"' + (q.clientId === c.id ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('') + '</select>') +
    '</div>' +
    _qtF('qtToName', 'Name as registered', _qtIn('qtToName', 'to.name', to.name, ' autocomplete="off"'),
      q.clientId == null ? 'Spell it as the recipient&rsquo;s own paper does (a letterhead, an order, a GST certificate): the registered spelling is confirmed there, not here.' : 'From the client master.') +
    _qtF('qtToAttn', 'Attention', _qtIn('qtToAttn', 'to.attn', to.attn, ' placeholder="e.g. The Director" autocomplete="off"')) +
    _qtF('qtToAddr', 'Address', '<textarea class="inv-textarea" rows="3" id="qtToAddr" data-qt-f="to.address">' + escHtml(to.address) + '</textarea>') +
    '<div class="inv-fields">' +
    _qtF('qtToGstin', 'GSTIN', '<input class="inv-input inv-id" id="qtToGstin" data-qt-f="to.gstin" maxlength="15" value="' + escHtml(to.gstin) + '" autocomplete="off">', 'Optional: left off the face when blank.') +
    _qtF('qtToState', 'State', _qtIn('qtToState', 'to.state', to.state, ' placeholder="(20) Jharkhand" autocomplete="off"')) +
    '</div>' +
    _qtF('qtIntro', 'Opening', '<textarea class="inv-textarea" rows="3" id="qtIntro" data-qt-f="intro">' + escHtml(q.intro) + '</textarea>') +
    '</div>';
  h += '<div id="qtLines">' + q.lines.map(function(l, i) { return qtLineHtml(l, i, q.lines.length); }).join('') + '</div>' +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary" data-action="invQtLineAdd">Add item</button></div>';
  h += '<div class="inv-panel"><div class="inv-fields">' +
    _qtF('qtGst', 'GST %', _qtNumIn('qtGst', 'gstPct', q.gstPct)) +
    _qtF('qtSac', 'SAC', '<input class="inv-input inv-id" id="qtSac" data-qt-f="sac" value="' + escHtml(q.sac) + '" autocomplete="off">') +
    '</div><div class="inv-field"><span class="inv-field-label">Transport</span><div class="inv-seg" role="group" aria-label="Transport">' + QT_TRANSPORT.map(function(o) {
      return '<button type="button" class="inv-seg-btn" data-action="invQtTransport" data-v="' + o[0] + '" aria-pressed="' + (q.transport === o[0]) + '" title="' + QT_TRANSPORT_WHY[o[0]] + '">' + o[1] + '</button>';
    }).join('') + '</div><div class="inv-field-hint">' + QT_TRANSPORT_WHY[q.transport] + '</div></div><div class="inv-fields">' +
    (q.transport === 'included' ? _qtF('qtMinKg', 'Minimum consignment, kg', _qtNumIn('qtMinKg', 'minConsignmentKg', q.minConsignmentKg)) : '') +
    _qtF('qtLot', 'Lot size, pieces', _qtNumIn('qtLot', 'lotPcs', q.lotPcs, 1)) +
    _qtF('qtValid', 'Valid, days', _qtNumIn('qtValid', 'validDays', q.validDays, 1)) +
    _qtF('qtPay', 'Payment, days', _qtNumIn('qtPay', 'paymentDays', q.paymentDays, 1)) +
    '</div></div>';
  h += '<div class="inv-panel"><div class="inv-panel-head"><span class="inv-panel-title">Terms &amp; conditions</span></div><div id="qtTerms">' + qtTermsHtml() + '</div>' +
    '<div class="inv-toolbar"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invQtTermAdd">Add a term</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invQtTermsReset">Reset to the standard terms</button></div></div>';
  h += '<div class="inv-actionbar"><div class="inv-actionbar-total"><div class="inv-actionbar-label">' + escHtml(q.num ? qtNumberText(q) : 'Draft') + '</div>' +
    '<div class="inv-actionbar-value">' + escHtml(todoPlural(q.lines.length, 'item')) + '</div></div>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invQtSaveDraft">Save draft</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invQtIssueForm">Issue</button></div>';
  return h;
}
function qtFormAfter() { /* nothing to bind: every field speaks through the delegated input and change handlers */ }
function qtRedrawForm() {
  var el = document.getElementById('clientsPageContent');
  if (el && _qtForm) el.innerHTML = qtFormHtml();
}
function qtTermsRefresh() {
  var f = _qtForm;
  if (!f) return;
  if (f.termsAuto) f.q.terms = qtTermsFor(f.q);
  var el = document.getElementById('qtTerms');
  if (el) el.innerHTML = qtTermsHtml();
}
function _qtNum(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
var QT_NUM_FIELDS = { gstPct: 1, minConsignmentKg: 1, lotPcs: 1, validDays: 1, paymentDays: 1 };
/* Every field of the form, held as typed; a field that the terms are written from rewrites them in place. */
function qtOnInput(el) {
  if (!_qtForm || !el || !el.dataset) return false;
  var q = _qtForm.q;
  if (el.dataset.qtTerm != null) {
    q.terms[+el.dataset.qtTerm] = el.value;
    if (_qtForm.termsAuto) { _qtForm.termsAuto = false; var hint = el.closest('#qtTerms'); if (hint) { var h = hint.querySelector(':scope > .inv-field-hint'); if (h) h.textContent = 'Edited by hand: the options no longer rewrite them.'; } }
    return true;
  }
  if (el.dataset.qtLine != null) {
    var l = q.lines[+el.dataset.qtLine], k = el.dataset.qtLf;
    if (!l) return true;
    l[k] = k === 'rate' || k === 'refWeightKg' ? _qtNum(el.value) : el.value;
    var info = document.getElementById('qtLineInfo' + el.dataset.qtLine);
    if (info) info.innerHTML = qtLineInfo(+el.dataset.qtLine);
    if (k !== 'note' && k !== 'desc') qtTermsRefresh();
    return true;
  }
  var key = el.dataset.qtF;
  if (!key || key === 'clientId') return !!key;
  if (key.indexOf('to.') === 0) q.to[key.slice(3)] = el.value;
  else q[key] = QT_NUM_FIELDS[key] ? _qtNum(el.value) : el.value;
  if (QT_NUM_FIELDS[key] || key === 'sac') qtTermsRefresh();
  if (key === 'date') q.lines.forEach(function(x, i) { var info = document.getElementById('qtLineInfo' + i); if (info) info.innerHTML = qtLineInfo(i); });
  return true;
}
/* The recipient picked from the book fills what the client master holds; the form is drawn again. */
function qtOnChange(el) {
  if (!el || !el.dataset) return false;
  if (el.id === 'qtStatusFilter') { _qtStatus = el.value; qtRenderList(); return true; }
  if (!_qtForm) return false;
  if (el.dataset.qtF === 'clientId') {
    var q = _qtForm.q, c = (S.clients || []).find(function(x) { return String(x.id) === el.value; });
    q.clientId = c ? c.id : null;
    if (c) q.to = { name: c.name || '', address: [c.add1, c.add2, c.add3].filter(function(x) { return String(x || '').trim(); }).join('\n'),
      gstin: c.gstin || '', state: c.state ? (c.stateCode ? '(' + c.stateCode + ') ' : '') + c.state : '', attn: q.to.attn || '' };
    qtRedrawForm();
    return true;
  }
  return !!(el.dataset.qtF || el.dataset.qtLine != null || el.dataset.qtTerm != null);
}
function qtSearchInput(el) {
  if (!el || el.id !== 'qtSearch') return false;
  _qtSearch = el.value;
  qtRenderList();
  return true;
}

/* Holds the form's record in the book as a draft; returns it. */
function qtStoreDraft() {
  var f = _qtForm, q = qtCopy(f.q), now = Date.now();
  q.lines = q.lines.filter(function(l) { return String(l.item || '').trim() || String(l.partNumber || '').trim() || l.rate > 0; });
  q.lines.forEach(function(l) { l.item = String(l.item || '').trim(); l.partNumber = String(l.partNumber || '').trim(); if (l.rate != null) l.rate = gstRound(l.rate); });
  q.to.name = String(q.to.name || '').trim();
  q.to.gstin = String(q.to.gstin || '').trim().toUpperCase();
  q.terms = (q.terms || []).map(function(t) { return String(t || '').trim(); }).filter(Boolean);
  q.status = 'draft';
  q.at = now;
  var list = getQuotations();
  if (q.id && qtFind(q.id)) list[list.indexOf(qtFind(q.id))] = q;
  else { q.id = qtUid(); q.createdAt = now; list.push(q); }
  f.q.id = q.id;
  return q;
}
async function qtSaveDraft() {
  var q = qtStoreDraft();
  saveState();
  _qtForm = null;
  _pageTyped = false;
  _qtActiveId = q.id;
  renderClientsPage();
  viewTop();
  showToast('Draft saved: it takes a number when it is issued');
}
/* What stops an issue: a quotation names somebody, prices something and says how long it holds. */
function qtIssueProblems(q) {
  var p = [];
  if (!String((q.to && q.to.name) || '').trim()) p.push('Name the recipient');
  if (!q.date) p.push('Enter the date');
  if (!(q.lines || []).length || q.lines.some(function(l) { return !(l.item || l.partNumber) || !(l.rate > 0); })) p.push('Every item needs a name and a rate above 0');
  if (!(q.validDays > 0)) p.push('Enter how many days it is valid');
  if (!(q.terms || []).length) p.push('Add the terms');
  return p;
}
/* Other live prices for the same item to the same recipient: a counterparty anchors at the lower. */
function qtRivals(q) {
  var keys = {};
  (q.lines || []).forEach(function(l) { var k = qtItemKey(l); if (k) keys[k] = true; });
  var nm = rateKey(q.to && q.to.name);
  return getQuotations().filter(function(o) {
    if (o.id === q.id || o.id === q.revOf || !qtLive(o)) return false;
    var same = (q.clientId != null && o.clientId === q.clientId) || (nm && rateKey(o.to && o.to.name) === nm);
    return same && (o.lines || []).some(function(l) { return keys[qtItemKey(l)]; });
  });
}
async function qtIssue(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'draft') return false;
  var probs = qtIssueProblems(q);
  if (probs.length) { await uiAlert({ title: 'Not ready to issue', body: probs.join('\n'), tone: 'warning' }); return false; }
  var fy = q.num ? q.fy : qtFyOf(q.date), num = q.num || qtNextNum(fy), disp = qtDisplay(fy, num, q.rev);
  var old = q.revOf ? qtFind(q.revOf) : null;
  if (!(await uiConfirm({ title: 'Issue ' + disp + '?', okLabel: 'Issue',
    body: 'It is dated ' + formatDate(q.date) + ' and goes to ' + qtRecipient(q) + '. An issued quotation is never edited: a change after this is a revision.' +
      (old ? '\n' + qtNumberText(old) + ' is superseded by it.' : '') }))) return false;
  var rivals = qtRivals(q).filter(function(o) { return !old || o.id !== old.id; });
  var supersedeRivals = false;
  if (rivals.length) {
    supersedeRivals = await uiConfirm({ title: 'Another live price for this item', okLabel: 'Mark superseded', cancelLabel: 'Keep both',
      body: rivals.map(function(o) { return qtNumberText(o) + ' of ' + formatDate(o.date) + ' (' + qtRateSummary(o) + ')'; }).join('\n') +
        '\nalready quotes ' + qtRecipient(q) + ' for the same item. Two live prices let a counterparty anchor at the lower. Mark ' + (rivals.length === 1 ? 'it' : 'them') + ' superseded by ' + disp + '?' });
  }
  q = qtFind(id);
  if (!q || q.status !== 'draft') return false;
  var now = Date.now();
  q.fy = fy; q.num = num; q.displayNumber = disp; q.status = 'issued'; q.issuedAt = now; q.at = now;
  old = q.revOf ? qtFind(q.revOf) : null;
  if (old && old.status !== 'void') { old.status = 'superseded'; old.supersededBy = q.id; old.supersededAt = now; old.at = now; }
  if (supersedeRivals) rivals.forEach(function(o) { var r = qtFind(o.id); if (r && qtLive(r)) { r.status = 'superseded'; r.supersededBy = q.id; r.supersededAt = now; r.at = now; } });
  saveState();
  showToast(disp + ' issued');
  return true;
}
async function qtIssueFromForm() {
  var probs = qtIssueProblems(Object.assign({}, _qtForm.q, { lines: _qtForm.q.lines.filter(function(l) { return String(l.item || '').trim() || String(l.partNumber || '').trim() || l.rate > 0; }) }));
  if (probs.length) { await uiAlert({ title: 'Not ready to issue', body: probs.join('\n'), tone: 'warning' }); return; }
  var q = qtStoreDraft();
  saveState();
  var ok = await qtIssue(q.id);
  _qtForm = null;
  _pageTyped = false;
  _qtActiveId = q.id;
  renderClientsPage();
  viewTop();
  if (!ok) showToast('Kept as a draft');
  else if (!_isDesktop) qtOpen(q.id);
}

async function qtRevise(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  var open = getQuotations().find(function(o) { return o.revOf === q.id && o.status === 'draft'; });
  if (open) { showToast('A revision of it is already drafted'); qtOpenForm(open.id); return; }
  var why = await uiPrompt({ title: 'Revise ' + qtNumberText(q), body: 'The revision is a draft with the same number, Rev ' + (qtRevNext(q)) + '. Issuing it supersedes this one. A new price after negotiation is a revision too.',
    label: 'Why is it revised?', required: true });
  if (!why) return;
  q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  var r = qtCopy(q), now = Date.now();
  Object.assign(r, { id: qtUid(), rev: qtRevNext(q), revOf: q.id, revReason: why, status: 'draft', issuedAt: null, acceptedAt: null, declinedAt: null,
    supersededBy: null, voidReason: '', createdAt: now, at: now, date: localDateStr() });
  r.displayNumber = qtDisplay(r.fy, r.num, r.rev);
  r.lines.forEach(function(l) { delete l.postedAt; delete l.postedTo; });
  getQuotations().push(r);
  saveState();
  qtOpenForm(r.id);
}
function qtRevNext(q) {
  var hi = 0;
  getQuotations().forEach(function(o) { if (o.fy === q.fy && o.num === q.num && (o.rev || 0) > hi) hi = o.rev || 0; });
  return hi + 1;
}
async function qtVoid(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  var why = await uiPrompt({ title: 'Void ' + qtNumberText(q), body: 'For a quotation issued but never sent. The number stays in the series with the reason; it is never used again.', label: 'Why is it void?', required: true });
  if (!why) return;
  q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  q.status = 'void'; q.voidReason = why; q.voidedAt = Date.now(); q.at = q.voidedAt;
  saveState();
  qtShown(id);
  showToast(qtNumberText(q) + ' void');
}
async function qtDecline(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  if (!(await uiConfirm({ title: 'Declined?', body: qtRecipient(q) + ' declined ' + qtNumberText(q) + '.', okLabel: 'Mark declined' }))) return;
  q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  q.status = 'declined'; q.declinedAt = Date.now(); q.at = q.declinedAt;
  saveState();
  qtShown(id);
}
async function qtDelete(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'draft') return;
  if (!(await uiConfirm({ title: 'Delete this draft?', body: 'A draft holds ' + (q.num ? 'the revision of ' + qtNumberText(q) + ', and the issued one stands.' : 'no number, so nothing in the series moves.'), okLabel: 'Delete draft', danger: true }))) return;
  S.quotations = getQuotations().filter(function(o) { return o.id !== id; });
  saveState();
  if (_qtActiveId === id) _qtActiveId = null;
  closeOverlay();
  qtShown(null);
}

/* ---------- Accepted: the rate offered to the client's card ---------- */
/* What would be written, and what has to be set by hand. Read README § "On conversion, the field matters". */
function qtPostPlan(q) {
  var c = qtClient(q), post = [], hand = [];
  (q.lines || []).forEach(function(l, i) {
    if (l.postedAt || !(l.rate > 0)) return;
    var name = l.item || l.partNumber, part = String(l.partNumber || '').trim();
    if (!c) { hand.push(name + ': the recipient is not a client in the book; add it, then set the rate on its card'); return; }
    if (!part) { hand.push(name + ': no part number, so no card entry can name it; set the rate on ' + c.name + '&rsquo;s card by hand'); return; }
    if (l.basis === 'piece' && c.billingMode === 'piece') {
      post.push({ i: i, field: 'pieceRates', text: 'a piece rate on ' + c.name + '&rsquo;s card: ' + part + (lineGauge(l.desc) ? ' · ' + lineGauge(l.desc) : '') + ', ' + formatCurrency(l.rate) + '/pc from ' + formatDate(localDateStr()) });
    } else if (l.basis === 'kg' && c.billingMode === 'piece') {
      hand.push(name + ': a per-kg rate for a client billed by the piece; set it on the card by hand');
    } else {
      var have = (c.itemRates || []).find(function(r) { return r.partPattern === part; });
      post.push({ i: i, field: 'itemRates', text: 'an item rate override on ' + c.name + ': ' + part + ' at ' + formatCurrency(l.rate) + '/' + (l.basis === 'piece' ? 'piece' : 'kg') +
        (have ? ' (replacing ' + formatCurrency(have.rate) + '/' + (have.unit || 'kg') + ')' : '') + '; the billing mode stays ' + (CLIENT_MODE_LABEL[c.billingMode] || c.billingMode) });
    }
  });
  return { client: c, post: post, hand: hand };
}
async function qtPostRates(id) {
  var q = qtFind(id), plan = q && qtPostPlan(q);
  if (!plan || !plan.post.length) {
    if (plan && plan.hand.length) await uiAlert({ title: 'Set the rate by hand', body: plan.hand.join('\n').replace(/&rsquo;/g, '’') });
    return;
  }
  var body = 'Writes ' + plan.post.map(function(p) { return p.text; }).join(';\n') + '.' + (plan.hand.length ? '\nBy hand: ' + plan.hand.join('; ') + '.' : '');
  if (!(await uiConfirm({ title: 'Post the accepted rate to ' + plan.client.name + '?', body: body.replace(/&rsquo;/g, '’'), okLabel: 'Post the rate' }))) return;
  q = qtFind(id);
  var c = qtClient(q);
  if (!q || !c) return;
  var now = Date.now(), today = localDateStr();
  qtPostPlan(q).post.forEach(function(p) {
    var l = q.lines[p.i], part = String(l.partNumber).trim();
    if (p.field === 'pieceRates') {
      (c.pieceRates || (c.pieceRates = [])).push({ partNumber: part, gauge: lineGauge(l.desc) || '', rate: gstRound(l.rate), effectiveFrom: today, source: 'quotation', quotation: qtNumberText(q), addedAt: now });
    } else {
      var row = { partPattern: part, rate: gstRound(l.rate), unit: l.basis === 'piece' ? 'piece' : 'kg', label: (l.item || part) + ' (' + qtNumberText(q) + ')' };
      var list = c.itemRates || (c.itemRates = []), at = list.findIndex(function(r) { return r.partPattern === part; });
      if (at >= 0) list[at] = row; else list.push(row);
    }
    l.postedAt = now; l.postedTo = p.field;
  });
  q.at = now;
  saveState();
  qtShown(id);
  showToast('Rate posted to ' + c.name);
}
async function qtAccept(id) {
  var q = qtFind(id);
  if (!q || q.status !== 'issued') return;
  q.status = 'accepted'; q.acceptedAt = Date.now(); q.at = q.acceptedAt;
  saveState();
  qtShown(id);
  showToast(qtNumberText(q) + ' accepted');
  if (qtPostPlan(q).post.length) await qtPostRates(id);
}

/* ---------- History ---------- */
function qtHistoryEvents(events, clientFilter) {
  getQuotations().forEach(function(q) {
    if (clientFilter && q.clientId != clientFilter) return;
    var nm = qtNumberText(q) + ' (' + qtRecipient(q) + ')';
    if (q.revOf && q.createdAt) events.push({ ts: q.createdAt, type: 'audit', kind: 'quoteRev', sourceId: null, jump: null, text: 'Quotation ' + nm + ' drafted as a revision — ' + (q.revReason || 'no reason recorded') });
    if (q.issuedAt) events.push({ ts: q.issuedAt, type: 'state', kind: 'quote', sourceId: null, jump: null, text: 'Quotation ' + nm + ' issued · ' + qtRateSummary(q) });
    if (q.acceptedAt) events.push({ ts: q.acceptedAt, type: 'state', kind: 'quote', sourceId: null, jump: null, text: 'Quotation ' + nm + ' accepted' });
    if (q.declinedAt) events.push({ ts: q.declinedAt, type: 'state', kind: 'quote', sourceId: null, jump: null, text: 'Quotation ' + nm + ' declined' });
    if (q.voidedAt) events.push({ ts: q.voidedAt, type: 'audit', kind: 'quoteVoid', sourceId: null, jump: null, text: 'Quotation ' + nm + ' voided — ' + (q.voidReason || 'no reason recorded') + ' [number stays spent]' });
    if (q.supersededAt) {
      var by = qtFind(q.supersededBy);
      events.push({ ts: q.supersededAt, type: 'audit', kind: 'quoteRev', sourceId: null, jump: null, text: 'Quotation ' + nm + ' superseded' + (by ? ' by ' + qtNumberText(by) : '') });
    }
  });
}

/* ---------- Doing ---------- */
function qtAction(action, btn) {
  if (action.indexOf('invQt') !== 0) return false;
  var id = btn.dataset.id, f = _qtForm;
  switch (action) {
    case 'invQtNew': qtOpenForm(null); break;
    case 'invQtOpen': qtOpen(id, btn.dataset.go === '1' && !btn.closest('.inv-scrim-dialog')); break;
    case 'invQtClosePane': qtShowPane(null); break;
    case 'invQtEdit': qtOpenForm(id); break;
    case 'invQtPrint': qtPrint(id); break;
    case 'invQtIssue': qtIssue(id).then(function(ok) { if (ok) qtShown(id); }); break;
    case 'invQtRevise': qtRevise(id); break;
    case 'invQtVoid': qtVoid(id); break;
    case 'invQtAccept': qtAccept(id); break;
    case 'invQtDecline': qtDecline(id); break;
    case 'invQtDelete': qtDelete(id); break;
    case 'invQtPost': qtPostRates(id); break;
    case 'invQtBack': qtCloseForm(); break;
    case 'invQtSaveDraft': if (f) qtSaveDraft(); break;
    case 'invQtIssueForm': if (f) qtIssueFromForm(); break;
    case 'invQtLineAdd': if (f) { f.q.lines.push(qtBlankLine()); qtRedrawForm(); var n = document.getElementById('qtL' + (f.q.lines.length - 1) + 'item'); if (n) n.focus(); } break;
    case 'invQtLineDel': if (f && f.q.lines.length > 1) { f.q.lines.splice(+btn.dataset.i, 1); _pageTyped = true; qtTermsRefresh(); qtRedrawForm(); } break;
    case 'invQtBasis': if (f && f.q.lines[+btn.dataset.i]) { f.q.lines[+btn.dataset.i].basis = btn.dataset.v; _pageTyped = true; qtTermsRefresh(); qtRedrawForm(); } break;
    case 'invQtTransport': if (f) { f.q.transport = btn.dataset.v; _pageTyped = true; qtTermsRefresh(); qtRedrawForm(); } break;
    case 'invQtTermAdd': if (f) { f.q.terms.push(''); f.termsAuto = false; _pageTyped = true; qtTermsRefresh(); var t = document.getElementById('qtTerm' + (f.q.terms.length - 1)); if (t) t.focus(); } break;
    case 'invQtTermDel': if (f) { f.q.terms.splice(+btn.dataset.i, 1); f.termsAuto = false; _pageTyped = true; qtTermsRefresh(); } break;
    case 'invQtTermsReset': if (f) { f.termsAuto = true; _pageTyped = true; qtTermsRefresh(); } break;
    default: return false;
  }
  return true;
}
