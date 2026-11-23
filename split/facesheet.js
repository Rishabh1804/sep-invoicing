/* ===== THE SHEETS ON PAPER (docs/ENTRY_FACES.md, step F5) =====
   Owner, 10 Oct 2026: "Every one will have an option to print out their sheets as well, if they want to fill in manually and
   file it in my table." Every face prints its own paper from Mine: Print my sheets (the blank sheet of each duty it carries, to
   fill by hand) and Print the day as entered (each duty's record of the day, to file). Production prints the same three for any
   day (More → Print sheets), so a sheet never waits on someone having an ID.
   The sheets that existed print as they were (the roll, front and back, and the attendance sheet: attsheet.js; the stock message
   and the stock as entered: stocksheet.js). Three are new, on the same page styles (inv-as-*), each an A4 sheet:
   - THE PICKLING SHEET: a load a row as the pickling hand's message carries it (when it went into the tank, the client, the part
     and its gauge, the quantity, re-pickled), and, where the face counts what comes in, Material in (the challan, the part and
     what was counted).
   - THE BARREL BATCH SHEET: a batch a row (the barrel, the client, the part, the quantity, in and out, rework).
   - THE VAT REGISTER PAGE: a page a line, as the register keeps it: VAT A1 a round a row (the time, the figure as written),
     VAT A2 a batch a row (began, ended, the figure); the day's total written; the day's power log.
   Filled, a sheet carries what the app holds for the day, whoever entered it and by which door (Mine, a message, a photo, by
   hand), each row saying which; a voided or corrected record never reaches paper. A VAT page entered on Mine prints as it was
   typed (its ditto, its START and END); a day read from a photo or a message prints its runs' rounds as written. */

var FSH_LOAD_ROWS = 26;        // a pickling sheet of loads alone
var FSH_LOAD_ROWS_BOTH = 17;   // with Material in under them
var FSH_IN_ROWS = 7;
var FSH_BATCH_ROWS = 24;
var FSH_ROUND_ROWS = 28;       // VAT A1, a round a row
var FSH_BATCH_PAGE_ROWS = 24;  // VAT A2, a batch a row
var FSH_CUT_ROWS = 4;
// A sheet printed for the days away (owner, 23 Nov 2026: forms filled by hand, photographed every half hour and read from the
// photo): its code, a strip of half hours and the paper's rule take the room of a few rows.
var FSH_CODED_LESS = 5;
var FSH_STOP_ROWS = 20;
var FSH_CODE_KIND = { 'vat-a1': 'VA1', 'vat-a2': 'VA2', barrel: 'BRL', pickling: 'PKL', stops: 'STP', attsheet: 'ATT' };
var FSH_STOP_WHY = ['Power', 'No material', 'Breakdown', 'Short of hands', 'Other'];
var FSH_DITTO = '"';           // the paper's ditto: the same client and part as the row above
var _fshDay = '';
var _fshPick = { pickling: true, barrel: true, 'vat-a1': true, 'vat-a2': true };

/* ---------- What a row says ---------- */
function fshByTime(a, b) {
  var x = relayParseHhmm(a.time), y = relayParseHhmm(b.time);
  return (x == null ? 1e9 : x) - (y == null ? 1e9 : y) || (a.at || 0) - (b.at || 0);
}
/* A time kept as HH:MM printed as the shop writes it ("9:45 AM"); anything else as written. */
function fshClock(t) { var m = relayParseHhmm(t); return m == null ? String(t || '') : faceClock(m); }
function fshClient(e) { return (e.clientId != null ? prodClientName(e.clientId) : '') || e.client || ''; }
function fshPart(e) {
  var p = String(e.part || e.partNumber || '').trim();
  return p + (e.gauge && p.replace(/[×✕]/g, 'X').toUpperCase().indexOf(String(e.gauge).toUpperCase()) < 0 ? ' (' + e.gauge + ')' : '');
}
function fshQty(q, u) { return q == null ? '' : u === 'KG' ? formatNum(q, q % 1 ? 2 : 0) : Math.round(q).toLocaleString('en-IN'); }
/* Which door a record came through, and who entered it there. */
function fshSource(e) {
  var who = e.by ? ', ' + e.by : '';
  return e.src === 'face' ? 'Mine' + who : e.src === 'paste' ? 'WhatsApp' + (e.sentBy ? ', ' + e.sentBy : '') : e.src === 'photo' ? 'Register photo' :
    e.src === 'import' ? 'Imported' : 'By hand' + who;
}
/* The records of one kind on a day, the latest version of each, in time order. */
function fshEntries(iso, kind) {
  var idx = prodIndex();
  return idx.live.filter(function(e) { return e.kind === kind && e.date === iso && !idx.replaced[e.id]; }).sort(fshByTime);
}
/* Cells: blank, or filled in the ink of a filled form. */
function fshTd(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + (v !== '' && v != null ? '<span class="inv-as-fill">' + escHtml(String(v)) + '</span>' : '') + '</td>'; }
function fshCols(keys) { return '<colgroup>' + keys.map(function(k) { return '<col data-as-col="' + k + '">'; }).join('') + '</colgroup>'; }
function fshTable(cols, heads, rows, attrs, short) {
  return '<table class="inv-as-table' + (short ? '' : ' inv-as-tall') + '" data-as-entry' + (attrs || '') + '>' + fshCols(cols) + '<thead><tr>' +
    heads.map(function(h, i) { return '<th' + (cols[i] === 'num' ? ' class="inv-as-tick"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
}
function fshBlankRows(n, cols, from) {
  var h = '';
  for (var i = 0; i < n; i++) h += '<tr><td class="inv-as-tick">' + (from + i) + '</td>' + new Array(cols).join('<td></td>') + '</tr>';
  return h;
}
/* Who the filled sheet's records came from, in one line: "12 on Mine by …, 3 from WhatsApp". */
function fshFromLine(list) {
  var by = {};
  list.forEach(function(e) { var k = e.src === 'face' ? 'on Mine' + (e.by ? ' by ' + e.by : '') : e.src === 'paste' ? 'from WhatsApp' : e.src === 'photo' ? 'read from a photo of the page' : e.src === 'import' ? 'imported' : 'entered by hand' + (e.by ? ' by ' + e.by : ''); by[k] = (by[k] || 0) + 1; });
  return Object.keys(by).map(function(k) { return by[k] + ' ' + k; }).join(', ');
}
/* ---------- A sheet to photograph as it fills ----------
   `o`: {coded: true, page: n}. The code says which sheet a photo is (its kind, the day, the page), in words a person and the
   reader both read; the rows of page 2 run on from page 1's, so a row's number is its own through the day. */
function fshFrom(o, perPage) { return o && o.coded && o.page > 1 ? (o.page - 1) * perPage + 1 : 1; }
function fshRowsFor(o, n) { return o && o.coded ? n - FSH_CODED_LESS : n; }
function fshCodeText(kind, iso, page) { return 'SEP SHEET ' + (FSH_CODE_KIND[kind] || kind) + ' ' + iso + ' PAGE ' + (page || 1); }
function fshCodedTop(kind, iso, o) {
  if (!o || !o.coded) return '';
  var cells = function(from) {
    var h = '';
    for (var m = from; m < from + 360; m += 30) h += '<td class="inv-as-tick">' + escHtml(faceClock(m).replace(/ (AM|PM)$/, '')) + '</td>';
    return h;
  };
  return '<div class="inv-as-slot" data-fsh-code="' + escHtml(fshCodeText(kind, iso, o.page)) + '">' + escHtml(fshCodeText(kind, iso, o.page)) + '</div>' +
    '<table class="inv-as-table" data-fsh="sent"><tbody><tr><th>Photo sent</th>' + cells(480) + '</tr><tr><th>Tick the time</th>' + cells(840) + '</tr></tbody></table>';
}
function fshCodedRule(o) {
  return o && o.coded ? ' A wrong row: strike it with one line and write it again on the next free row. Never write over a figure. When this page is full, go on to the next page of the same sheet. Send a photo of the whole page every half hour.' : '';
}
/* The stop sheet: one for the whole plant, a stop a row. */
function fshStopsHtml(iso, o) {
  var rows = fshBlankRows(FSH_STOP_ROWS, 7, fshFrom(o, FSH_STOP_ROWS));
  return '<div class="inv-as-page" data-sheet="stops">' + _asHead('Stops, the whole plant', iso, 'Office and floor') + fshCodedTop('stops', iso, o) +
    fshTable(['num', 'client', 'time', 'time', 'reason', 'note', 'note'], ['#', 'Line (VAT A1, VAT A2, Barrel, Pickling)', 'Stopped at', 'Started again at', 'Why', 'What was waiting', 'Note'], rows, ' data-fsh="stops"') +
    '<div class="inv-as-note">A stop a row, written when the line stops; write when it starts again on the same row. Why: write one of ' + escHtml(FSH_STOP_WHY.join(', ')) + '. A power cut is a stop on every line it stopped.' + fshCodedRule(o) + '</div>' +
    '<div class="inv-as-sign"><div>Filled by</div><div>Sent on WhatsApp at</div><div>Entered in the app by / on</div></div></div>';
}

function fshFiledFoot() {
  return '<div class="inv-as-note">Printed from the app ' + escHtml(formatTimestamp(Date.now())) + '. File it with the day\'s sheets.</div>';
}

/* ---------- The pickling sheet ---------- */
/* `parts`: {loads, incoming}, the sections the face's duties carry (both where neither is said). */
function fshPicklingHtml(iso, filled, parts, o) {
  parts = parts || { loads: true, incoming: true };
  var both = parts.loads && parts.incoming;
  var loads = filled && parts.loads ? fshEntries(iso, 'pickled') : [];
  var ins = filled && parts.incoming ? fshEntries(iso, 'arrived') : [];
  var h = '<div class="inv-as-page" data-sheet="' + (filled ? 'pickling-filled' : 'pickling') + '">' +
    _asHead(filled ? 'Pickling as entered in the app' : parts.loads ? 'Pickling loads' : 'Material in', iso, filled ? '' : 'Pickling hand') + (filled ? '' : fshCodedTop('pickling', iso, o));
  if (filled) h += '<div class="inv-as-note" data-fsh-from>' + escHtml(loads.length + ins.length ? 'As entered: ' + fshFromLine(loads.concat(ins)) + '.' : 'Nothing is recorded in the app for this day yet.') + '</div>';
  if (parts.loads) {
    var lr = loads.map(function(e, i) {
      return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(fshClock(e.time)) + fshTd(fshClient(e)) + fshTd(fshPart(e)) +
        fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(e.rework ? 'Yes' : '') + fshTd(fshSource(e)) + '</tr>';
    }).join('');
    if (!filled) lr = fshBlankRows(fshRowsFor(o, both ? FSH_LOAD_ROWS_BOTH : FSH_LOAD_ROWS), 8, fshFrom(o, fshRowsFor(o, both ? FSH_LOAD_ROWS_BOTH : FSH_LOAD_ROWS)));
    else if (!loads.length) lr = fshBlankRows(1, 8, 1);
    h += (both ? '<div class="inv-as-slot">Into the tank</div>' : '') +
      fshTable(['num', 'time', 'client', 'part', 'qty', 'unit', 'yes', 'note'], ['#', 'Into the tank at', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'Re-pickled', filled ? 'Entered' : 'Note'], lr, ' data-fsh="loads"');
  }
  if (parts.incoming) {
    var ir = ins.map(function(e, i) {
      return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(fshClock(e.time)) + fshTd(fshClient(e)) + fshTd(e.challanNo || '') +
        fshTd(fshPart(e)) + fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(fshSource(e)) + '</tr>';
    }).join('');
    if (!filled) ir = fshBlankRows(both ? FSH_IN_ROWS : fshRowsFor(o, FSH_LOAD_ROWS), 8, fshFrom(o, both ? FSH_IN_ROWS : fshRowsFor(o, FSH_LOAD_ROWS)));
    else if (!ins.length) ir = fshBlankRows(1, 8, 1);
    h += (both ? '<div class="inv-as-slot">Material in</div>' : '') +
      fshTable(['num', 'time', 'client', 'challan', 'part', 'qty', 'unit', 'note'], ['#', 'Came in at', 'Client', 'Challan no.', 'Part and gauge', 'Counted', 'NOS / KG', filled ? 'Entered' : 'Note'], ir, ' data-fsh="incoming"');
  }
  h += '<div class="inv-as-note">' + (parts.loads ? 'A load a row, written when it goes into the tank: the client, the part with its gauge where it has more than one, and the pieces or kilos. Tick Re-pickled for work done again: it counts as work, never billed. ' : '') +
    (parts.incoming ? 'Material in: count each line of a challan as it arrives, against the challan where there is one.' : '') + (filled ? '' : fshCodedRule(o)) + '</div>';
  return h + (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Filled by</div><div>Sent on WhatsApp at</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The barrel batch sheet ---------- */
/* The day's batches as the app counts them (a batch entered on Mine, else the supervisor's list): Production's own figure. */
function fshBatches(iso) { return prodDayLine(iso, 'barrel').entries.slice().sort(fshByTime); }
function fshBarrelHtml(iso, filled, o) {
  var list = filled ? fshBatches(iso) : [];
  var rows = list.map(function(e, i) {
    return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(e.barrel ? String(e.barrel).replace(/^barrel\s*/i, '') : '') + fshTd(fshClient(e)) +
      fshTd(fshPart(e)) + fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(fshClock(e.time)) + fshTd(fshClock(e.to)) + fshTd(e.rework ? 'Yes' : '') + fshTd(fshSource(e)) + '</tr>';
  }).join('');
  if (!filled) rows = fshBlankRows(fshRowsFor(o, FSH_BATCH_ROWS), 10, fshFrom(o, fshRowsFor(o, FSH_BATCH_ROWS)));
  else if (!list.length) rows = fshBlankRows(1, 10, 1);
  return '<div class="inv-as-page" data-sheet="' + (filled ? 'barrel-filled' : 'barrel') + '">' + _asHead(filled ? 'Barrel as entered in the app' : 'Barrel batches', iso, filled ? '' : 'Supervisor') + (filled ? '' : fshCodedTop('barrel', iso, o)) +
    (filled ? '<div class="inv-as-note" data-fsh-from>' + escHtml(list.length ? 'As entered: ' + fshFromLine(list) + '.' : 'Nothing is recorded in the app for this day yet.') + '</div>' : '') +
    fshTable(['num', 'barrel', 'client', 'part', 'qty', 'unit', 'time', 'time', 'yes', 'note'], ['#', 'Barrel', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'In', 'Out', 'Rework', filled ? 'Entered' : 'Note'], rows, ' data-fsh="batches"') +
    '<div class="inv-as-note">A batch a row: the barrel, the client, the part with its gauge, the pieces or kilos, when it went in and when it came out. Tick Rework for work done again: it counts as work, never billed.' + (filled ? '' : fshCodedRule(o)) + '</div>' +
    (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Filled by the supervisor</div><div>Sent on WhatsApp at</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The VAT register page ---------- */
/* What a line's page holds for the day: the page entered on Mine as it was typed, else the runs the app counts (a photo, a
   message, by hand), a round a row as written. A page whose run the owner voided or corrected in Production prints from the
   runs: the page as typed would put on paper what the book no longer holds. {style, rows: [{time, to, client, part, fig, note}],
   total, from, n}. */
function fshVatRead(iso, line) {
  var pg = faceVatPage(iso, line);
  if (pg && !faceVatTouched(iso, line).length) {
    var style = pg.style || faceVatStyleOf(line), prev = null;
    return { style: style, total: pg.total != null ? pg.total : null, n: (pg.rows || []).length,
      from: 'Entered on Mine' + (pg.by ? ' by ' + pg.by : '') + (pg.at ? ' at ' + faceClock(new Date(pg.at).getHours() * 60 + new Date(pg.at).getMinutes()) : '') + '.',
      rows: (pg.rows || []).map(function(r) {
        var same = faceVatSameRun(r, prev);
        prev = r;
        return { time: fshClock(r.time), to: fshClock(r.to), client: same ? FSH_DITTO : prodClientName(r.client) || '', part: same ? FSH_DITTO : String(r.part || ''), fig: String(r.fig || ''), note: '' };
      }) };
  }
  var runs = prodDayLine(iso, line).entries.slice().sort(fshByTime), rows = [], batches = false;
  runs.forEach(function(e) {
    var rs = Array.isArray(e.rounds) && e.rounds.length ? e.rounds : null;
    var head = { client: fshClient(e), part: fshPart(e) };
    if (!rs) { rows.push({ time: fshClock(e.time), to: fshClock(e.to), client: head.client, part: head.part, fig: fshQty(e.qty, e.unit) + (e.unit === 'KG' ? ' kg' : ''), note: fshSource(e) }); return; }
    rs.forEach(function(x, k) {
      if (x.batch) batches = true;
      var fig = x.written != null ? String(x.written) : x.qty != null ? String(x.qty) : '';
      // A round's time is the page's own writing ("1:05" on a register is the afternoon): printed as written.
      rows.push({ time: x.batch ? (k === 0 ? fshClock(e.time) : '') : String(x.time || ''), to: x.batch ? String(x.time || '') : '', client: k ? FSH_DITTO : head.client, part: k ? FSH_DITTO : head.part,
        fig: fig, note: (k ? '' : fshSource(e)) + (x.struck ? (k ? '' : ' · ') + 'struck, not counted' : '') });
    });
  });
  return { style: batches ? 'batches' : faceVatStyleOf(line), rows: rows, total: pg && pg.total != null ? pg.total : null, n: rows.length, from: runs.length ? 'As entered: ' + fshFromLine(runs) + '.' : '' };
}
/* The day's power log, as Power reads it: a cut reported twice is one. */
function fshCutsRows(iso, filled) {
  var cuts = filled && typeof powerCuts === 'function' ? powerCuts(iso, iso) : [];
  var rows = cuts.map(function(c, i) {
    return '<tr><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(powerClock(c.from)) + fshTd(c.to == null ? '' : powerClock(c.to) + (c.overnight ? ' next day' : '')) +
      fshTd(c.reason && typeof pcsName === 'function' ? pcsName(c.reason) : '') + fshTd(c.note || '') + '</tr>';
  }).join('');
  if (!filled) rows = fshBlankRows(FSH_CUT_ROWS, 5, 1);
  else if (!cuts.length) rows = '<tr><td class="inv-as-tick"></td><td colspan="4">No power cut recorded on this day.</td></tr>';
  return rows;
}
function fshVatHtml(iso, line, filled, o) {
  var rd = filled ? fshVatRead(iso, line) : { style: faceVatStyleOf(line), rows: [], total: null, from: '' };
  var batches = rd.style === 'batches', label = PROD_LINE_LABEL[line] || line;
  var day = filled ? prodDayLine(iso, line) : null;
  var rows = rd.rows.map(function(r, i) {
    return '<tr><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(r.time) + (batches ? fshTd(r.to) : '') + fshTd(r.client) + fshTd(r.part) + fshTd(r.fig) + fshTd(r.note) + '</tr>';
  }).join('');
  var nCols = batches ? 7 : 6;
  var perPage = fshRowsFor(o, batches ? FSH_BATCH_PAGE_ROWS : FSH_ROUND_ROWS);
  if (!filled) rows = fshBlankRows(perPage, nCols, fshFrom(o, perPage));
  else if (!rd.rows.length) rows = fshBlankRows(1, nCols, 1);
  var cols = batches ? ['num', 'time', 'time', 'client', 'part', 'fig2', 'note'] : ['num', 'time', 'client', 'part', 'fig2', 'note'];
  var heads = batches ? ['#', 'Began (START)', 'Ended (END)', 'Client', 'Part', 'Figure as written', 'Note'] : ['#', 'Time', 'Client', 'Part', 'Figure as written', 'Note'];
  var counted = day && (day.nos || day.kgWritten) ? [day.nos ? Math.round(day.nos).toLocaleString('en-IN') + ' NOS' : '', day.kgWritten ? formatNum(day.kgWritten, 0) + ' kg' : ''].filter(Boolean).join(' + ') : '';
  return '<div class="inv-as-page" data-sheet="' + (filled ? 'vat-filled' : 'vat') + '" data-line="' + escHtml(line) + '">' +
    _asHead(escHtml(label) + (filled ? ' register as entered in the app' : ' register'), iso, filled ? '' : 'Register clerk') +
    (filled ? '<div class="inv-as-note" data-fsh-from>' + escHtml(rd.from || 'Nothing is recorded in the app for ' + label + ' on this day yet.') + '</div>' : fshCodedTop(line, iso, o)) +
    fshTable(cols, heads, rows, ' data-fsh="rounds"', true) +
    '<div class="inv-as-grid">' + _asFillField('Day total written', rd.total != null ? fshQty(+rd.total, 'NOS') : '') + _asFillField('Counted by the app', counted) + '</div>' +
    '<div class="inv-as-slot">Power log</div>' +
    '<table class="inv-as-table" data-as-entry data-fsh="cuts">' + fshCols(['num', 'time', 'time', 'reason', 'note']) +
    '<thead><tr><th class="inv-as-tick">#</th><th>Power cut at</th><th>Power in at</th><th>Why</th><th>Note</th></tr></thead><tbody>' + fshCutsRows(iso, filled) + '</tbody></table>' +
    '<div class="inv-as-note">' + (batches ? 'A batch a row: when it began (START), when it ended (END), and the figure at the end as written (3×156, 96×7+5).' :
      'A round a row: the time and the figure as written (120, 3+4×156, 96×7+5); the app adds it up.') + ' Write the client and the part where a run begins, and " under them while it runs on. Strike a round that did not happen.' + (filled ? '' : fshCodedRule(o)) + '</div>' +
    (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Written by</div><div>Checked by</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The sheets of a face ---------- */
/* Each duty's paper: its blank sheet and the day as entered. A sheet two duties share prints once (the roll's two sides; the
   pickling sheet carries Material in). `has` says whether the day holds anything for it. */
var FSH_SHEETS = [
  { id: 'roll', duties: ['roll-in', 'roll-out'], title: 'The roll, in time and out time', page: 'pageStaff',
    blank: function(d) { return attSheetShyamHtml(d); },
    filled: function(d) { return attSheetShyamHtml(d, attDay(d, false), 'As entered in the app.'); },
    has: function(d) { var r = attDay(d, false); return !!(r && Object.keys(r.marks || {}).length); } },
  { id: 'attsheet', duties: ['attsheet'], title: 'The attendance sheet', page: 'pageStaff',
    blank: function(d) { return attSheetDeepakHtml(d, false); }, filled: function(d) { return attSheetDeepakHtml(d, true); },
    has: function(d) { var r = attDay(d, false); return !!(r && Object.keys(r.marks || {}).length); } },
  { id: 'pickling', duties: ['pickling', 'incoming'], title: 'The pickling sheet', page: 'pageProduction',
    blank: function(d, ds) { return fshPicklingHtml(d, false, fshPicklingParts(ds)); }, filled: function(d, ds) { return fshPicklingHtml(d, true, fshPicklingParts(ds)); },
    has: function(d, ds) { var p = fshPicklingParts(ds); return (p.loads && fshEntries(d, 'pickled').length > 0) || (p.incoming && fshEntries(d, 'arrived').length > 0); } },
  { id: 'stock', duties: ['stock'], title: 'The stock message', page: 'pageStock',
    // As entered: the stock with its bills and prices for a role that sees money, else the supervisor's own sheet filled (a face
    // never prints a money figure its role does not see).
    blank: function(d) { return stockSheetSupHtml(d, false); },
    filled: function(d) { return grdSeesMoney() ? stockSheetDeepakHtml(d, true) : stockSheetSupHtml(d, true, 'As entered in the app.'); },
    has: function(d) { return (stockData().entries || []).some(function(e) { return e && e.date === d && !e.voided; }); } },
  { id: 'barrel', duties: ['barrel'], title: 'The barrel batch sheet', page: 'pageProduction',
    blank: function(d) { return fshBarrelHtml(d, false); }, filled: function(d) { return fshBarrelHtml(d, true); },
    has: function(d) { return fshBatches(d).length > 0; } },
  { id: 'vat', duties: ['vat'], title: 'The VAT register pages', page: 'pageProduction',
    blank: function(d) { return FACE_VAT_LINES.map(function(l) { return fshVatHtml(d, l, false); }).join(''); },
    filled: function(d) { return FACE_VAT_LINES.filter(function(l) { return fshVatHas(d, l); }).map(function(l) { return fshVatHtml(d, l, true); }).join(''); },
    has: function(d) { return FACE_VAT_LINES.some(function(l) { return fshVatHas(d, l); }); } }
];
function fshPicklingParts(duties) {
  var ds = duties || ['pickling', 'incoming'];
  return { loads: ds.indexOf('pickling') >= 0, incoming: ds.indexOf('incoming') >= 0 };
}
function fshVatHas(d, line) { return !!faceVatPage(d, line) || prodDayLine(d, line).entries.length > 0; }
/* The sheets a person's duties carry, each with the duties that brought it. */
function fshSheetsOf(u) {
  var ids = faceDuties(u).map(function(d) { return d.id; });
  return FSH_SHEETS.map(function(s) { return { s: s, duties: s.duties.filter(function(x) { return ids.indexOf(x) >= 0; }) }; }).filter(function(x) { return x.duties.length; });
}

/* Mine → Paper: one row, the person's sheets blank or the day as entered. */
function fshFaceRowHtml(u, day) {
  var list = fshSheetsOf(u);
  if (!list.length) return '';
  var have = list.filter(function(x) { return x.s.has(day, x.duties); });
  var meta = list.map(function(x) { return x.s.title.replace(/^The /, '').replace(/^./, function(c) { return c.toUpperCase(); }); }).join(' · ');
  return '<div class="inv-row inv-row-2 inv-row-flow" data-face-sheets><span class="inv-row-main"><span class="inv-row-title">My sheets</span>' +
    '<span class="inv-row-meta inv-row-wrap">' + escHtml(meta + (have.length ? '' : ' · nothing entered on ' + formatDate(day) + ' yet')) + '</span></span>' +
    '<span class="inv-row-end inv-row-actions inv-toolbar inv-toolbar-tight">' +
    '<button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFacePrint" data-kind="blank">Print my sheets</button>' +
    '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invFacePrint" data-kind="filled"' + (have.length ? '' : ' disabled') + '>Print the day as entered</button></span></div>';
}
function fshFacePrint(kind) {
  var u = faceUser(), day = faceDayIso(), list = fshSheetsOf(u);
  if (kind === 'filled') list = list.filter(function(x) { return x.s.has(day, x.duties); });
  if (!list.length) { showToast(kind === 'filled' ? 'Nothing is entered on ' + formatDate(day) + ' yet' : 'No sheet goes with these duties', 'warning'); return; }
  // Another ID opens them from the office's queue only where its screens show the same: each sheet's page, and money where the
  // stock as entered carries its bills and prices (print.js printNeed).
  var pages = list.map(function(x) { return x.s.page; }).filter(function(p, i, a) { return a.indexOf(p) === i; });
  var money = kind === 'filled' && list.some(function(x) { return x.s.id === 'stock'; }) && grdSeesMoney();
  fshShow(list.map(function(x) { return x.s[kind === 'filled' ? 'filled' : 'blank'](day, x.duties); }).join(''), (kind === 'filled' ? 'As entered ' : 'Sheets ') + day,
    { pages: pages, money: money });
}
/* The print view, as the other sheets open it. */
function fshShow(html, title, need) {
  document.getElementById('invPrintBody').innerHTML = html;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printNeed(need);
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = title;
}

/* ---------- Production → More → Print sheets: any day, the floor's three ---------- */
var FSH_PROD = [['pickling', 'Pickling sheet', 'loads into the tank, and material in'], ['barrel', 'Barrel batches', 'a batch a row: barrel, client, part, in and out'],
  ['vat-a1', 'VAT A1 register page', 'a round a row'], ['vat-a2', 'VAT A2 register page', 'a batch a row: began and ended']];
// The days away (owner, 23 Nov 2026): a stack for a run of days, each sheet coded for the photo, with two sheets more.
var FSH_STACK = [['stops', 'Stop sheet', 'the whole plant: line, stopped at, started again, why'], ['attsheet', 'Attendance sheet', 'the day\'s roster, to tick']];
var FSH_STACK_MAX_DAYS = 31;
var _fshTo = '', _fshStack = { coded: false, spare: true, skip: '' };
/* The attendance sheet to photograph lists the hands on the floor, less the ones named in the dialog as away for the run.
   A name is matched whole or by its first word, whatever the case; a name that matches nobody is said, and the sheet prints. */
function fshAttSkipWords() { return String(_fshStack.skip || '').split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean); }
function fshAttSkipped(w, words) {
  var n = String(w.name || '').trim().toLowerCase();
  return (words || fshAttSkipWords()).some(function(x) { return n === x || n.split(/\s+/)[0] === x; });
}
function fshAttKeep(w) { return w.onFloor !== false && !fshAttSkipped(w); }
function fshAttSkipMissed() {
  var roster = typeof attDayRoster === 'function' ? attDayRoster(null) : [];
  return fshAttSkipWords().filter(function(x) { return !roster.some(function(w) { return fshAttSkipped(w, [x]); }); });
}
function fshProdOpen() {
  if (!_fshDay) _fshDay = localDateStr();
  var pick = function(x) { return '<label class="inv-field-check"><input type="checkbox" class="inv-check" data-fsh-pick="' + x[0] + '"' + (_fshPick[x[0]] ? ' checked' : '') + '><span>' + x[1] + ' <span class="inv-note">' + x[2] + '</span></span></label>'; };
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Print sheets') +
    '<div class="inv-field"><label class="inv-field-label" for="fshDate">Day</label><input type="date" id="fshDate" class="inv-input" data-nodirty value="' + escHtml(_fshDay) + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="fshTo">To (a run of days, blank sheets only)</label><input type="date" id="fshTo" class="inv-input" data-nodirty value="' + escHtml(_fshTo) + '"></div>' +
    '<div class="inv-field">' + FSH_PROD.concat(FSH_STACK).map(pick).join('') + '</div>' +
    '<div class="inv-field"><label class="inv-field-check"><input type="checkbox" class="inv-check" id="fshCoded"' + (_fshStack.coded ? ' checked' : '') + '><span>To photograph as it fills <span class="inv-note">each blank sheet carries its code, a strip of half hours and the rule for a wrong row</span></span></label>' +
    '<label class="inv-field-check"><input type="checkbox" class="inv-check" id="fshSpare"' + (_fshStack.spare ? ' checked' : '') + '><span>A spare page 2 of each <span class="inv-note">for a sheet that fills before the day ends</span></span></label></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="fshSkip">Away for the run: leave off the attendance sheet to photograph</label><input type="text" id="fshSkip" class="inv-input" data-nodirty placeholder="Names, a comma between" value="' + escHtml(_fshStack.skip) + '"></div>' +
    '<div class="inv-field-hint">Blank, to fill by hand; or as entered for the day, to file (a sheet with nothing entered is left out). A run of days leaves out Sundays and days marked shut.</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invFshPreview" data-kind="filled">As entered</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invFshPreview" data-kind="blank">Blank</button></div></div>', { dismiss: true });
}
/* The days of a run: from the day to `to`, the days the plant is not expected to work left out. One day is always itself. */
function fshRunDays(from, to) {
  if (!to || to <= from) return [from];
  var out = [], d = new Date(from + 'T00:00:00');
  for (var i = 0; i < FSH_STACK_MAX_DAYS; i++) {
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (iso > to) break;
    if (!(typeof attDayNotExpected === 'function' && attDayNotExpected(iso))) out.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
/* One blank sheet of a kind, for a day; `o` as fshCodedTop's. The attendance sheet has one page: the roster is its rows. */
function fshBlankOf(kind, day, o) {
  if (kind === 'pickling') return fshPicklingHtml(day, false, null, o);
  if (kind === 'barrel') return fshBarrelHtml(day, false, o);
  if (kind === 'stops') return fshStopsHtml(day, o);
  if (kind === 'attsheet') return o && o.page > 1 ? '' : attSheetDeepakHtml(day, false, o && o.coded ? '<div class="inv-as-slot" data-fsh-code="' + escHtml(fshCodeText('attsheet', day, 1)) + '">' + escHtml(fshCodeText('attsheet', day, 1)) + '</div>' : '', fshAttKeep);
  return fshVatHtml(day, kind, false, o);
}
function fshProdPreview(kind) {
  var d = document.getElementById('fshDate'), t = document.getElementById('fshTo'), cd = document.getElementById('fshCoded'), sp = document.getElementById('fshSpare');
  if (d && d.value) _fshDay = d.value;
  if (t) _fshTo = t.value || '';
  if (cd) _fshStack.coded = cd.checked;
  if (sp) _fshStack.spare = sp.checked;
  var sk = document.getElementById('fshSkip');
  if (sk) _fshStack.skip = sk.value.trim();
  document.querySelectorAll('[data-fsh-pick]').forEach(function(el) { _fshPick[el.dataset.fshPick] = el.checked; });
  var day = _fshDay || localDateStr(), filled = kind === 'filled', h = '', left = [];
  var picked = FSH_PROD.concat(FSH_STACK).filter(function(x) { return _fshPick[x[0]]; });
  if (!filled) {
    var days = fshRunDays(day, _fshTo);
    if (_fshTo && _fshTo > day && days.length >= FSH_STACK_MAX_DAYS) { showToast('A run is at most ' + FSH_STACK_MAX_DAYS + ' days: print it in two', 'error'); return; }
    days.forEach(function(iso) {
      picked.forEach(function(x) {
        h += fshBlankOf(x[0], iso, _fshStack.coded ? { coded: true, page: 1 } : null);
        if (_fshStack.coded && _fshStack.spare) h += fshBlankOf(x[0], iso, { coded: true, page: 2 });
      });
    });
    if (!h) { showToast(days.length ? 'Pick at least one sheet' : 'No working day in that run', 'error'); return; }
    closeOverlay();
    fshShow(h, 'Production sheets ' + day + (days.length > 1 ? ' to ' + days[days.length - 1] : ''), { pages: ['pageProduction'] });
    if (days.length > 1) showToast(days.length + ' days, ' + document.querySelectorAll('#invPrintBody .inv-as-page').length + ' sheets', 'info');
    var missed = _fshStack.coded && _fshPick.attsheet ? fshAttSkipMissed() : [];
    if (missed.length) showToast('Not on the roster, so not left off: ' + missed.join(', '), 'warning');
    return;
  }
  FSH_PROD.forEach(function(x) {
    if (!_fshPick[x[0]]) return;
    var line = x[0].indexOf('vat-') === 0 ? x[0] : null;
    var has = x[0] === 'pickling' ? fshEntries(day, 'pickled').length + fshEntries(day, 'arrived').length > 0 : x[0] === 'barrel' ? fshBatches(day).length > 0 : fshVatHas(day, line);
    if (!has) { left.push(x[1]); return; }
    h += x[0] === 'pickling' ? fshPicklingHtml(day, true) : x[0] === 'barrel' ? fshBarrelHtml(day, true) : fshVatHtml(day, line, true);
  });
  if (!h) { showToast(left.length ? 'Nothing is entered on ' + formatDate(day) + ' for ' + left.join(', ') : 'Pick at least one sheet', 'error'); return; }
  closeOverlay();
  fshShow(h, 'Production as entered ' + day, { pages: ['pageProduction'] });
  if (left.length) showToast('Left out, nothing entered: ' + left.join(', '), 'warning');
}
