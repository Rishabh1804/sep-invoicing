/* ===== STOCK SHEETS: the paper route for stock (owner, 29 Sep 2026: "we will do the same for Stock as that has enter
   by hand option as well. Plus, we need physical copy for record keeping") =====
   The attendance sheets' route (attsheet.js), for the chemical stock, on their page styles (inv-as-*):
   - THE SUPERVISOR'S SHEET, his WhatsApp stock message on paper: the window it covers, then one numbered line per stock
     line in the numbering his last message used (lastPos), with opening, added (date and quantity), used (days × a
     day = total), available. The names are printed: they are the shop's chemicals, not people, and a fixed number beside
     each settles the line his message sometimes sends with no name.
   - DEEPAK'S SHEET, Stock → Enter by hand on paper: the four kinds as columns (count, received with its ₹ per unit, used,
     charged into), the app's level at the start of the day beside each line so a count can be checked on the spot, the
     bill of a delivery (company, invoice, date), and the three signatures.
   - THE FILLED COPY: the same form carrying every entry the app holds for the day, pasted or by hand, and the level
     after it. */

var _stockSheetPick = { sup: true, deepak: true, filled: true };
var _stockSheetDate = '';

// Active lines in the supervisor's numbering: his last message's first, then the rest after them.
function stockSheetLines() {
  var items = stockData().items.filter(function(i) { return i.active !== false; });
  var numbered = items.filter(function(i) { return Number.isInteger(i.lastPos); }).sort(function(a, b) { return a.lastPos - b.lastPos; });
  var rest = items.filter(function(i) { return !Number.isInteger(i.lastPos); });
  var next = numbered.reduce(function(m, i) { return Math.max(m, i.lastPos); }, 0);
  return numbered.map(function(i) { return { item: i, n: i.lastPos }; })
    .concat(rest.map(function(i) { return { item: i, n: ++next }; }));
}
function _ssQty(v) { return v == null ? '' : stockFmtQty(v); }

/* An earlier day with stock recorded is printed filled on the supervisor's sheet, as a worked example (owner, 29 Sep
   2026); today and a day with nothing recorded, blank. */
function stockSheetFillFor(iso) {
  return iso < localDateStr() && (stockData().entries || []).some(function(e) { return e.date === iso && !e.voided && e.kind !== 'bill'; });
}

function stockSheetSupHtml(iso, filled) {
  var lines = stockSheetLines();
  var next = lines.reduce(function(m, l) { return Math.max(m, l.n); }, 0);
  var day = filled ? (stockData().entries || []).filter(function(e) { return e.date === iso && !e.voided && e.kind !== 'bill'; }) : [];
  var f = function(v) { return v ? '<span class="inv-as-fill">' + escHtml(v) + '</span>' : ''; };
  var rows = lines.map(function(l) {
    var cells = ['', '', '', ''];
    if (filled) {
      var mine = day.filter(function(e) { return e.itemId === l.item.id; });
      if (mine.length) {
        // A message's opening is a count on its first day: the opening printed is that count where the day starts with
        // one, else the level the day began at. The level before the day left a one-day message not footing.
        var dayRows = stockReplay(l.item.id, isoAddDays(iso, 1)).rows.filter(function(r) { return r.e.date === iso; });
        cells[0] = _ssQty(dayRows.length > 1 && dayRows[0].e.kind === 'count' ? dayRows[0].after : stockReplay(l.item.id, iso).level);
        cells[1] = mine.filter(function(e) { return e.kind === 'received'; }).map(function(e) { return stockShortDate(e.date) + ' · ' + _ssQty(e.qty); }).join(', ');
        cells[2] = mine.filter(function(e) { return e.kind === 'used' || e.kind === 'charged'; }).map(function(e) {
          var d = e.days > 1 ? e.days : 0;
          return d ? d + ' × ' + _ssQty(stockRound(e.qty / d)) + ' = ' + _ssQty(e.qty) : _ssQty(e.qty) + (e.kind === 'charged' && e.note ? ' (' + e.note + ')' : '');
        }).join(', ');
        cells[3] = _ssQty(stockReplay(l.item.id, isoAddDays(iso, 1)).level);
      }
    }
    return '<tr><td class="inv-as-tick">' + escHtml(String(l.n)) + ')</td><td>' + escHtml(l.item.name) + '</td><td>' + escHtml(l.item.unit || '') + '</td>' +
      cells.map(function(c) { return '<td>' + f(c) + '</td>'; }).join('') + '<td></td></tr>';
  }).join('');
  for (var k = 1; k <= 3; k++) rows += '<tr><td class="inv-as-tick">' + escHtml(String(next + k)) + ')</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  // The window the message covered: the paste that recorded the day, else the day itself.
  var paste = filled ? (stockData().pastes || []).find(function(p) { return p.from && p.to && p.from <= iso && iso <= p.to; }) : null;
  return '<div class="inv-as-page" data-sheet="stock-sup"' + (filled ? ' data-filled' : '') + '>' + _asHead('Chemical use · chemical stock', iso, 'Supervisor') +
    (filled ? '<div class="inv-as-note">Filled from the app&rsquo;s record of this day, as a worked example.</div>' : '') +
    '<div class="inv-as-grid">' + _asFillField('From', filled ? formatDate(paste ? paste.from : iso) : '') + _asFillField('To', filled ? formatDate(paste ? paste.to : iso) : '') + '</div>' +
    '<table class="inv-as-table inv-as-tall"><thead><tr><th class="inv-as-tick">#</th><th>Line</th><th>Unit</th><th>Opening</th>' +
    '<th>Added (date · qty)</th><th>Used (days × a day = total)</th><th>Available</th><th>Note</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="inv-as-note">Write each line against its number, as in the WhatsApp message. Used: the days it covers × the use a day, and the total.</div>' +
    '<div class="inv-as-sign"><div>Filled by</div><div>Sent on WhatsApp at</div><div>Handed to Deepak at</div></div></div>';
}

/* Deepak's form, blank or filled with the day's entries. */
function stockSheetDeepakHtml(iso, filled) {
  var lines = stockSheetLines(), next = isoAddDays(iso, 1), bills = [];
  var dayEntries = filled ? (stockData().entries || []).filter(function(e) { return e.date === iso && !e.voided; }) : [];
  var rows = lines.map(function(l) {
    var start = stockReplay(l.item.id, iso).level;
    var cell = { count: '', received: '', price: '', used: '', charged: '' };
    if (filled) dayEntries.forEach(function(e) {
      if (e.itemId !== l.item.id) return;
      if (e.kind === 'bill' || e.kind === 'received') {
        if (e.supplier || e.billNo) bills.push(e);
        if (e.kind === 'bill') return;
      }
      var add = function(k, v) { cell[k] = cell[k] === '' ? v : cell[k] + ' + ' + v; };
      add(e.kind, _ssQty(e.qty) + (e.kind === 'charged' && e.note ? ' (' + e.note + ')' : ''));
      if (e.kind === 'received' && e.price != null) add('price', formatNum(e.price, 2));
    });
    var after = filled ? stockReplay(l.item.id, next).level : null;
    return '<tr><td class="inv-as-tick">' + escHtml(String(l.n)) + '</td><td>' + escHtml(l.item.name) + '</td><td>' + escHtml(l.item.unit || '') + '</td>' +
      '<td>' + escHtml(_ssQty(start)) + '</td><td>' + escHtml(cell.count) + '</td><td>' + escHtml(cell.received) + '</td><td>' + escHtml(cell.price) + '</td>' +
      '<td>' + escHtml(cell.used) + '</td><td>' + escHtml(cell.charged) + '</td>' + (filled ? '<td>' + escHtml(_ssQty(after)) + '</td>' : '') + '</tr>';
  }).join('');
  if (!filled) for (var k = 0; k < 2; k++) rows += '<tr><td class="inv-as-tick"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';

  // One row per bill: the company, the invoice and its date, the lines on it.
  var byBill = {};
  bills.forEach(function(e) {
    var k = (e.supplier || '') + '|' + (e.billNo || '');
    var b = byBill[k] || (byBill[k] = { supplier: e.supplier || '', billNo: e.billNo || '', billDate: e.billDate || e.date, lines: [] });
    var it = stockItem(e.itemId);
    if (it && b.lines.indexOf(it.name) < 0) b.lines.push(it.name);
  });
  var billRows = Object.keys(byBill).map(function(k) {
    var b = byBill[k];
    return '<tr><td>' + escHtml(b.supplier) + '</td><td>' + escHtml(b.billNo) + '</td><td>' + escHtml(formatDate(b.billDate)) + '</td><td>' + escHtml(b.lines.join(', ')) + '</td></tr>';
  }).join('');
  if (!filled || !billRows) for (var j = 0; j < (filled ? 1 : 3); j++) billRows += '<tr><td></td><td></td><td></td><td></td></tr>';

  var title = filled ? 'Stock as entered in the app' : 'Stock entry';
  return '<div class="inv-as-page" data-sheet="' + (filled ? 'stock-filled' : 'stock-deepak') + '">' + _asHead(title, iso, filled ? '' : 'Deepak') +
    (filled && !dayEntries.length ? '<div class="inv-as-note">Nothing is recorded in the app for this day yet.</div>' : '') +
    '<table class="inv-as-table"><thead><tr><th class="inv-as-tick">#</th><th>Line</th><th>Unit</th><th>App level at start</th><th>Count</th>' +
    '<th>Received</th><th>&#8377; / unit</th><th>Used</th><th>Charged (into)</th>' + (filled ? '<th>Level after</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="inv-as-slot">Delivery bill</div>' +
    '<table class="inv-as-table"><thead><tr><th>Company</th><th>Invoice no.</th><th>Invoice date</th><th>Lines</th></tr></thead><tbody>' + billRows + '</tbody></table>' +
    '<div class="inv-as-note">Count: what is on the shelf. Received: a delivery, with its bill; &#8377; per unit before GST. Used: drawn from stock. Charged: put into a bath. Fill only the lines that changed.</div>' +
    (filled
      ? '<div class="inv-as-note">Printed from the app ' + escHtml(formatTimestamp(Date.now())) + '. Staple behind the supervisor\'s and Deepak\'s sheets for the day.</div>'
      : '<div class="inv-as-sign"><div>Filled by the supervisor</div><div>Checked by Deepak</div><div>Entered in the app by / on</div></div>') +
    '</div>';
}

/* Stock → Print sheets: the day, which of the three, then the preview. */
function stockSheetOpen() {
  if (!_stockSheetDate) _stockSheetDate = localDateStr();
  var c = function(k, label, sub) {
    return '<label class="inv-field-check"><input type="checkbox" class="inv-check" data-ss-pick="' + k + '"' + (_stockSheetPick[k] ? ' checked' : '') + '> ' +
      label + ' <span class="inv-note">' + sub + '</span></label>';
  };
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Print stock sheets') +
    '<div class="inv-field"><label class="inv-field-label" for="stockSheetDate">Day</label><input type="date" id="stockSheetDate" class="inv-input" data-nodirty value="' + escHtml(_stockSheetDate) + '"></div>' +
    '<div class="inv-field">' +
    c('sup', 'Supervisor\'s sheet', 'his WhatsApp stock message, numbered as he sends it; an earlier day with stock recorded comes out filled, as a worked example') +
    c('deepak', 'Deepak\'s sheet', 'Enter by hand: count, received, used, charged, the bill') +
    c('filled', 'Filled copy', 'what the app holds for the day') +
    '</div><div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invStockSheetPreview">Preview</button></div></div>', { dismiss: true });
}

function stockSheetPreview() {
  var d = document.getElementById('stockSheetDate');
  if (d && d.value) _stockSheetDate = d.value;
  document.querySelectorAll('[data-ss-pick]').forEach(function(el) { _stockSheetPick[el.dataset.ssPick] = el.checked; });
  var iso = _stockSheetDate || localDateStr();
  var h = (_stockSheetPick.sup ? stockSheetSupHtml(iso, stockSheetFillFor(iso)) : '') + (_stockSheetPick.deepak ? stockSheetDeepakHtml(iso, false) : '') +
    (_stockSheetPick.filled ? stockSheetDeepakHtml(iso, true) : '');
  if (!h) { showToast('Pick at least one sheet', 'error'); return; }
  closeOverlay();
  document.getElementById('invPrintBody').innerHTML = h;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = 'Stock ' + iso;
}
