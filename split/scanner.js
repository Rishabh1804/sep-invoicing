/* ===== CHALLAN SCANNER (Phase 4 — AI Vision) ===== */
var _scanExtractionPrompt = 'You are parsing an Indian delivery challan image for a zinc electroplating job work factory.\n\nExtract ALL data into this exact JSON structure. Return ONLY valid JSON, no markdown, no backticks, no explanation.\n\n{"challanNo":"string - just digits, strip leading zeros and FY suffix like /26-27","challanDate":"YYYY-MM-DD format","clientName":"string","vehicleNo":"string","items":[{"partNumber":"string","desc":"string","unit":"KG or NOS","qty":0,"nosQty":null,"rate":0,"amount":0}]}\n\nRULES for Dorabji Auto challans (printed white paper with DELIVERY CHALLAN header):\n- Qty column = NOS count -> put in nosQty\n- Wt.(Kgs.) column = weight in KG -> put in qty\n- Rate and Total columns = Dorabji internal pricing -> IGNORE\n- Set rate to 13, amount = qty * 13, unit = KG\n- Strip TRIVALENT YELLOW, FE, DO from description\n\nRULES for SSS Mehta challans (pink handwritten paper):\n- Qty = NOS count -> put in both qty AND nosQty\n- Amount column -> put in amount, Rate = amount/qty\n- unit = NOS\n\nFor other clients: KG billing, extract weight as qty.\nChallan number: just numeric part e.g. 0041/26-27 -> 41';

var _scanClientMap = {
  'DORABJI': {name:'DORABJI AUTO', rate:13},
  'SSSMEHTA': {name:'SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD', rate:5.40},
  'SAMARTH': {name:'SAMARTH ENGG. CO. PVT. LTD.', rate:14.50},
  'HIGHCO': {name:'HIGHCO ENGINEERS PVT. LTD.', rate:11},
  'PARAKH': {name:'PARAKH INDUSTRIES', rate:10},
  'PAWAN': {name:'PAWAN AUTO P LTD', rate:10.50},
  'OM SHEET': {name:'OM SHEET METALS', rate:14.25},
  'GENERAL': {name:'GENERAL ENGINEERING CORPORATION', rate:14.25},
  'DILIP': {name:'DILIP PRESS METAL & AGROTECH P LTD', rate:13.50},
  'KHURANA': {name:'KHURANA INDUSTRIES', rate:14.25}
};

/* The client a challan names, as {id, name, rate}. Names are compared with case, spaces and punctuation ignored
   (rateKey), and only against the book's own clients: the one named exactly, else the one whose name contains the
   challan's or is contained in it ("S.S.S. Mehta" is the book's SSSMEHTA ENTERPRISES …) — and only when one client
   fits, never a guess between two. The map below is kept for its rates alone, for a client the book does not hold:
   its ids are the seed's and name nobody on another book, and matching its short names by raw substring read
   "GENERAL AUTO PARTS" as General Engineering and missed "SSS MEHTA" for want of the space. Such a client has no id,
   so the operator picks it; the rate prices the lines until then. */
function _scanFindClient(key) {
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
function _scanMatchClient(name) {
  var key = rateKey(name);
  var held = _scanFindClient(key);
  if (held) return { id: held.id, name: held.name, rate: null };
  for (var short in _scanClientMap) {
    if (key.length >= 5 && key.indexOf(rateKey(short)) >= 0) return { id: null, name: _scanClientMap[short].name, rate: _scanClientMap[short].rate };
  }
  return null;
}

/* A figure as Gemini wrote it — a number, or text such as "282.70" or "1,234.5" — as a number; unreadable is 0.
   A string reaching the billing arithmetic threw (imRefsBilled's toFixed), at the save and at every boot after it. */
function _scanNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(/[,\s\u20B9]/g, ''));
  return isFinite(n) ? n : 0;
}
/* "Kg", "KGS", "kgs." are kilograms; "Nos", "NOS.", "pcs" are pieces. The prompt asks for KG or NOS. */
function _scanUnit(u) {
  var k = String(u || '').toUpperCase().replace(/[^A-Z]/g, '');
  return /^(NOS?|NUMBERS?|PCS?|PIECES?)$/.test(k) ? 'NOS' : 'KG';
}
/* The challan's date as YYYY-MM-DD: as asked, or as a date is written on paper (04/08/2026, 4-8-26). Anything else is
   left blank for the operator to enter — a day guessed would file the receipt, and its duplicate check, on the wrong date. */
function _scanDate(v) {
  var s = String(v == null ? '' : v).trim(), m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return isoFromDmy(+m[3], +m[2], +m[1]) || '';
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s))) return isoFromDmy(+m[1], +m[2], +m[3]) || '';
  return '';
}

function scanChallan() {
  var apiKey = getApiKey();
  if (!apiKey) {
    showToast('Set your Gemini API key in Settings first (free from aistudio.google.com)', 'warning');
    return;
  }
  var inp = document.getElementById('scanFileInput');
  if (!inp) return;
  inp.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    inp.value = '';
    _processScanImage(file);
  };
  inp.click();
}

function _processScanImage(file) {
  // Show processing overlay
  var proc = document.getElementById('scanProcessing');
  if (proc) {
    proc.innerHTML = '<div class="inv-scan-processing"><div class="inv-scan-processing-card">' +
      '<div class="inv-scan-spinner"></div>' +
      '<div class="inv-scan-processing-text">Reading challan</div>' +
      '<div class="inv-scan-processing-sub">Gemini is extracting the data</div></div></div>';
  }

  // The request is vision.js's, sent exactly as this scanner always sent it (the original bytes and the prompt, no
  // schema); the messages below are the scanner's own, unchanged.
  geminiReadImage(file, _scanExtractionPrompt).then(function(res) {
    if (proc) proc.innerHTML = '';
    if (res.ok) { _applyScanResult(res.json); return; }
    if (res.code === 'api' || res.code === 'quota') showToast('API error: ' + (res.error || 'Unknown'), 'error');
    else if (res.code === 'json') showToast('Failed to parse response', 'error');
    else if (res.code === 'empty' || res.code === 'blocked' || res.code === 'truncated') showToast('No response from Gemini', 'error');
    else showToast('Scan failed: ' + res.error, 'error');
  });
}

function _applyScanResult(parsed) {
  parsed = parsed && typeof parsed === 'object' ? parsed : {};
  // What Gemini wrote, made into what the form and the book hold: numbers as numbers, the unit as KG or NOS, the date
  // as YYYY-MM-DD (blank when it could not be read), text as text.
  var challanDate = _scanDate(parsed.challanDate);
  var items = (Array.isArray(parsed.items) ? parsed.items : []).map(function(it) {
    it = it && typeof it === 'object' ? it : {};
    var nos = Math.round(_scanNum(it.nosQty));
    return { partNumber: String(it.partNumber == null ? '' : it.partNumber).trim(), desc: String(it.desc == null ? '' : it.desc).trim(),
      unit: _scanUnit(it.unit), qty: _scanNum(it.qty), nosQty: nos > 0 ? nos : null, rate: _scanNum(it.rate), amount: _scanNum(it.amount), _auto: {} };
  });
  // Match client
  var client = _scanMatchClient(parsed.clientName);
  if (client) {
    // T-HC: the rate comes from the client's own records, never from the rate
    // frozen into _scanClientMap. That map's figures are only its fallback for
    // a client the app does not hold — the scanner used to price every KG line
    // off them, so a rate change or an itemRates override never reached a
    // scanned challan, and a matcher would read the scanner's lines as wrong
    // against a correct rate card.
    // A rate the record put in is marked the record's (_auto), so choosing another client re-prices it; the challan's
    // own figures (a piece client's amount) are not.
    var appClient = client.id != null ? S.clients.find(function(c) { return c.id === client.id; }) || null : null;
    var onDate = challanDate || localDateStr();
    items.forEach(function(item) {
      if (!appClient) {
        if (item.unit === 'KG' && client.rate) {
          item.rate = client.rate;
          item.amount = gstRound(item.qty * client.rate);
          item._auto.rate = true;
        }
        return;
      }
      var info = getLineItemRate(appClient, onDate, item.partNumber);
      var piece = item.unit === 'NOS' ? getPieceRate(appClient, onDate, item.partNumber, item.desc) : null;
      if (info._override) {
        item.rate = info.rate;
        item.amount = gstRound(item.qty * info.rate);
        item._auto.rate = true;
      } else if (item.unit === 'KG') {
        item.rate = info.ratePerKg || 0;
        item.amount = gstRound(item.qty * item.rate);
        item._auto.rate = item.rate > 0;
      } else if (piece && piece.rate != null && !(appClient.billingMode === 'piece' && item.amount > 0)) {
        // A piece client's challan states its own amount; that figure is the
        // passthrough and is kept. The card fills only what the challan left out.
        item.rate = piece.rate;
        item.amount = gstRound(item.qty * piece.rate);
        item._auto.rate = true;
        item._auto.amount = true;
      }
    });
  }

  // Pre-fill the Add Challan form
  _challanForm = {
    clientId: client && client.id != null ? client.id : null,
    challanNo: String(parsed.challanNo == null ? '' : parsed.challanNo).trim(),
    challanDate: challanDate,
    vehicleNo: String(parsed.vehicleNo == null ? '' : parsed.vehicleNo).trim(),
    items: items.map(function(item) {
      return {
        partNumber: item.partNumber,
        desc: item.desc || item.partNumber,
        hsn: '998873',
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        nosQty: item.nosQty,
        _auto: item._auto
      };
    }),
    notes: ''
  };

  if (_challanForm.items.length === 0) {
    _challanForm.items.push({partNumber:'', desc:'', hsn:'998873', unit:'KG', qty:0, rate:0, amount:0, nosQty:null});
  }

  renderAddChallanForm();
  // What the scan could not settle is said, so the operator knows where to look before saving.
  var unread = [];
  if (!_challanForm.clientId) unread.push('pick the client' + (client ? ' (read as ' + client.name + ')' : ''));
  if (!challanDate) unread.push('enter the date');
  showToast('Challan scanned: ' + items.length + ' item' + (items.length !== 1 ? 's' : '') + ' found' +
    (unread.length ? ' · ' + unread.join(', ') : ''), unread.length ? 'warning' : 'success');
}

