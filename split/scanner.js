/* ===== CHALLAN SCANNER (Phase 4 — AI Vision) ===== */
var _scanExtractionPrompt = 'You are parsing an Indian delivery challan image for a zinc electroplating job work factory.\n\nExtract ALL data into this exact JSON structure. Return ONLY valid JSON, no markdown, no backticks, no explanation.\n\n{"challanNo":"string - just digits, strip leading zeros and FY suffix like /26-27","challanDate":"YYYY-MM-DD format","clientName":"string","vehicleNo":"string","items":[{"partNumber":"string","desc":"string","unit":"KG or NOS","qty":0,"nosQty":null,"rate":0,"amount":0}]}\n\nRULES for Dorabji Auto challans (printed white paper with DELIVERY CHALLAN header):\n- Qty column = NOS count -> put in nosQty\n- Wt.(Kgs.) column = weight in KG -> put in qty\n- Rate and Total columns = Dorabji internal pricing -> IGNORE\n- Set rate to 13, amount = qty * 13, unit = KG\n- Strip TRIVALENT YELLOW, FE, DO from description\n\nRULES for SSS Mehta challans (pink handwritten paper):\n- Qty = NOS count -> put in both qty AND nosQty\n- Amount column -> put in amount, Rate = amount/qty\n- unit = NOS\n\nFor other clients: KG billing, extract weight as qty.\nChallan number: just numeric part e.g. 0041/26-27 -> 41';

var _scanClientMap = {
  'DORABJI': {id:1, name:'DORABJI AUTO', rate:13},
  'SSSMEHTA': {id:2, name:'SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD', rate:5.40},
  'SAMARTH': {id:3, name:'SAMARTH ENGG. CO. PVT. LTD.', rate:14.50},
  'HIGHCO': {id:4, name:'HIGHCO ENGINEERS PVT. LTD.', rate:11},
  'PARAKH': {id:5, name:'PARAKH INDUSTRIES', rate:10},
  'PAWAN': {id:6, name:'PAWAN AUTO P LTD', rate:10.50},
  'OM SHEET': {id:7, name:'OM SHEET METALS', rate:14.25},
  'GENERAL': {id:8, name:'GENERAL ENGINEERING CORPORATION', rate:14.25},
  'DILIP': {id:9, name:'DILIP PRESS METAL & AGROTECH P LTD', rate:13.50},
  'KHURANA': {id:13, name:'KHURANA INDUSTRIES', rate:14.25}
};

function _scanMatchClient(name) {
  if (!name) return null;
  var upper = name.toUpperCase();
  for (var key in _scanClientMap) {
    if (upper.indexOf(key) >= 0) return _scanClientMap[key];
  }
  return null;
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
    _processScanImage(file, apiKey);
  };
  inp.click();
}

function _processScanImage(file, apiKey) {
  // Show processing overlay
  var proc = document.getElementById('scanProcessing');
  if (proc) {
    proc.innerHTML = '<div class="inv-scan-processing"><div class="inv-scan-processing-card">' +
      '<div class="inv-scan-spinner"></div>' +
      '<div class="inv-scan-processing-text">Reading challan</div>' +
      '<div class="inv-scan-processing-sub">Gemini is extracting the data</div></div></div>';
  }

  var reader = new FileReader();
  reader.onload = function(ev) {
    var base64 = ev.target.result.split(',')[1];
    var mediaType = file.type || 'image/jpeg';

    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: _scanExtractionPrompt }
          ]
        }]
      })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (proc) proc.innerHTML = '';
      if (data.error) {
        showToast('API error: ' + (data.error.message || 'Unknown'), 'error');
        return;
      }
      // Extract text from Gemini response
      var text = '';
      try {
        var parts = data.candidates[0].content.parts;
        for (var p = 0; p < parts.length; p++) {
          if (parts[p].text) text += parts[p].text;
        }
      } catch(ex) {
        showToast('No response from Gemini', 'error');
        return;
      }
      var clean = text.replace(/```json|```/g, '').trim();
      var parsed;
      try { parsed = JSON.parse(clean); } catch(err) {
        showToast('Failed to parse response', 'error');
        return;
      }
      _applyScanResult(parsed);
    })
    .catch(function(err) {
      if (proc) proc.innerHTML = '';
      showToast('Scan failed: ' + err.message, 'error');
    });
  };
  reader.readAsDataURL(file);
}

function _applyScanResult(parsed) {
  // Match client
  var client = _scanMatchClient(parsed.clientName);
  if (client) {
    parsed.clientId = client.id;
    parsed.clientName = client.name;
    (parsed.items || []).forEach(function(item) {
      if (item.unit === 'KG' && client.rate) {
        item.rate = client.rate;
        item.amount = gstRound((item.qty || 0) * client.rate);
      }
    });
  }

  // Pre-fill the Add Challan form
  _challanForm = {
    clientId: parsed.clientId || null,
    challanNo: parsed.challanNo || '',
    challanDate: parsed.challanDate || localDateStr(),
    vehicleNo: parsed.vehicleNo || '',
    items: (parsed.items || []).map(function(item) {
      return {
        partNumber: item.partNumber || '',
        desc: item.desc || item.partNumber || '',
        hsn: '998873',
        unit: item.unit || 'KG',
        qty: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        nosQty: item.nosQty || null
      };
    }),
    notes: ''
  };

  if (_challanForm.items.length === 0) {
    _challanForm.items.push({partNumber:'', desc:'', hsn:'998873', unit:'KG', qty:0, rate:0, amount:0, nosQty:null});
  }

  renderAddChallanForm();
  showToast('Challan scanned: ' + (parsed.items || []).length + ' item' + ((parsed.items || []).length !== 1 ? 's' : '') + ' found');
}

