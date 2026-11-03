/* ===== CHALLAN SCANNER (read by Claude) =====
   Challans → More → Scan a challan, and a challan reached through Production's photo reader ("Read it as a challan"). The photo
   is read by Claude (photoread.js, SCAN_PROMPT): the challan's number, date, client and vehicle and its lines as written. The
   form then opens filled, and nothing is saved until the challan is checked and saved there, as any challan typed by hand.
   It came back on 3 Nov 2026 (owner) after Gemini's reading was taken out on 13 Oct; the build carries no client's name or rate
   (HR-10): the client is one of the book's own, and every rate is the client's own record.
*/
var _scanBusy = false;

/* The client a challan names: one of the book's own, compared with case, spaces and punctuation ignored (rateKey): the one named
   exactly, else the one whose name contains the challan's or is contained in it, and only when one client fits, never a guess
   between two. */
function _scanFindClient(name) {
  var key = rateKey(name || '');
  if (key.length < 5) return null;
  var exact = null, near = [];
  (S.clients || []).forEach(function(c) {
    var ck = rateKey(c.name);
    if (!ck) return;
    if (ck === key) exact = c;
    else if (ck.length >= 5 && (ck.indexOf(key) >= 0 || key.indexOf(ck) >= 0)) near.push(c);
  });
  return exact || (near.length === 1 ? near[0] : null);
}
/* A figure as written (a number, or text such as "282.70" or "1,234.5") as a number; unreadable is 0. */
function _scanNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(/[,\s₹]/g, ''));
  return isFinite(n) ? n : 0;
}
function _scanUnit(u) {
  var k = String(u || '').toUpperCase().replace(/[^A-Z]/g, '');
  return /^(NOS?|NUMBERS?|PCS?|PIECES?)$/.test(k) ? 'NOS' : 'KG';
}
/* The challan's date as YYYY-MM-DD, as written on paper (04/08/2026, 4-8-26) or as an ISO date. Anything else is left blank: a
   day guessed would file the receipt, and its duplicate check, on the wrong date. */
function _scanDate(v) {
  var s = String(v == null ? '' : v).trim(), m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return isoFromDmy(+m[3], +m[2], +m[1]) || '';
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s))) return isoFromDmy(+m[1], +m[2], +m[3]) || '';
  return '';
}

function scanChallan() {
  if (!phKey()) { phNoKey(); return; }
  var inp = document.getElementById('scanFileInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'scanFileInput'; inp.accept = 'image/*'; inp.className = 'inv-hidden';
    inp.setAttribute('data-nodirty', ''); inp.tabIndex = -1; inp.setAttribute('aria-hidden', 'true');
    document.body.appendChild(inp);
  }
  inp.onchange = function(e) { var file = e.target.files[0]; inp.value = ''; if (file) scanChallanFile(file); };
  inp.click();
}
/* No key on this device: said, with the way to Settings. */
function phNoKey() {
  uiConfirm({ title: 'Claude key needed', okLabel: 'Open Settings',
    body: 'Reading a photo uses the Claude key in Settings → Connections → Photo reading (from console.anthropic.com). A challan or a register page can be entered by hand without one.' })
    .then(function(ok) { if (ok) openSettings('claudeKey'); });
}
/* The photo read and the challan form opened on it: Challans' add form, filled from the reading. */
async function scanChallanFile(file) {
  if (_scanBusy) { showToast('A challan is being read already', 'warning'); return; }
  _scanBusy = true;
  showToast('Claude is reading the challan…');
  var res;
  try { res = await phRead(file, SCAN_PROMPT, SCAN_SCHEMA); } finally { _scanBusy = false; }
  if (!res.ok) { phSayFail('Challan photo', res); return; }
  if (typeof switchTab === 'function') switchTab('pageIM');
  if (typeof showAddChallanForm === 'function') showAddChallanForm();
  _applyScanResult(res.json, res.meta);
}

function _applyScanResult(parsed, meta) {
  parsed = parsed && typeof parsed === 'object' ? parsed : {};
  var challanDate = _scanDate(parsed.challanDate);
  var items = (Array.isArray(parsed.items) ? parsed.items : []).map(function(it) {
    it = it && typeof it === 'object' ? it : {};
    var nos = Math.round(_scanNum(it.nosQty));
    return { partNumber: String(it.partNumber == null ? '' : it.partNumber).trim(), desc: String(it.desc == null ? '' : it.desc).trim(),
      unit: _scanUnit(it.unit), qty: _scanNum(it.qty), nosQty: nos > 0 ? nos : null, rate: 0, amount: _scanNum(it.amount), _auto: {} };
  });
  // Every rate is the client's own record (T-HC), never the paper's: an override in the line's own unit, else the client's
  // ladder for a kilo line, else its piece card. A piece client's amount written on the challan is the passthrough and is kept.
  var client = _scanFindClient(parsed.clientName);
  if (client) {
    var onDate = challanDate || localDateStr();
    items.forEach(function(item) {
      var ov = itemRateFor(client, onDate, item);
      var piece = item.unit === 'NOS' ? getPieceRate(client, onDate, item.partNumber, item.desc) : null;
      if (ov && ov.fits) {
        item.rate = ov.rate;
        item.amount = gstRound(item.qty * (ov.how === 'weight' ? ov.kgPc : 1) * ov.rate);
        item._auto.rate = true;
      } else if (item.unit === 'KG') {
        item.rate = clientLadderRate(client, onDate);
        item.amount = gstRound(item.qty * item.rate);
        item._auto.rate = item.rate > 0;
      } else if (piece && piece.rate != null && !(client.billingMode === 'piece' && item.amount > 0)) {
        item.rate = piece.rate;
        item.amount = gstRound(item.qty * piece.rate);
        item._auto.rate = true;
        item._auto.amount = true;
      } else if (item.amount > 0 && item.qty > 0) item.rate = gstRound(item.amount / item.qty, 4);
    });
  }
  _challanForm = {
    clientId: client ? client.id : null,
    challanNo: String(parsed.challanNo == null ? '' : parsed.challanNo).trim(),
    challanDate: challanDate,
    vehicleNo: String(parsed.vehicleNo == null ? '' : parsed.vehicleNo).trim(),
    items: items.map(function(item) {
      return { partNumber: item.partNumber, desc: item.desc || item.partNumber, hsn: '998873', unit: item.unit, qty: item.qty,
        rate: item.rate, amount: item.amount, nosQty: item.nosQty, _auto: item._auto };
    }),
    notes: '',
    _scanned: { at: Date.now(), model: meta && meta.model || PH_MODEL }
  };
  if (!_challanForm.items.length) _challanForm.items.push({ partNumber: '', desc: '', hsn: '998873', unit: 'KG', qty: 0, rate: 0, amount: 0, nosQty: null });
  renderAddChallanForm();
  // What the read could not settle is said, so the operator knows where to look before saving.
  var unread = [];
  if (!_challanForm.clientId) unread.push('pick the client' + (parsed.clientName ? ' (read as ' + parsed.clientName + ')' : ''));
  if (!challanDate) unread.push('enter the date');
  showToast('Challan read: ' + todoPlural(items.length, 'line') + (meta && meta.usd ? ' · ' + phMoney(meta.usd) : '') +
    (unread.length ? ' · ' + unread.join(', ') : '') + ' · check every line before saving', unread.length ? 'warning' : 'success');
}
