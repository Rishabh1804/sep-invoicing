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
function fshFiledFoot() {
  return '<div class="inv-as-note">Printed from the app ' + escHtml(formatTimestamp(Date.now())) + '. File it with the day\'s sheets.</div>';
}

/* ---------- The pickling sheet ---------- */
/* `parts`: {loads, incoming}, the sections the face's duties carry (both where neither is said). */
function fshPicklingHtml(iso, filled, parts) {
  parts = parts || { loads: true, incoming: true };
  var both = parts.loads && parts.incoming;
  var loads = filled && parts.loads ? fshEntries(iso, 'pickled') : [];
  var ins = filled && parts.incoming ? fshEntries(iso, 'arrived') : [];
  var h = '<div class="inv-as-page" data-sheet="' + (filled ? 'pickling-filled' : 'pickling') + '">' +
    _asHead(filled ? 'Pickling as entered in the app' : parts.loads ? 'Pickling loads' : 'Material in', iso, filled ? '' : 'Pickling hand');
  if (filled) h += '<div class="inv-as-note" data-fsh-from>' + escHtml(loads.length + ins.length ? 'As entered: ' + fshFromLine(loads.concat(ins)) + '.' : 'Nothing is recorded in the app for this day yet.') + '</div>';
  if (parts.loads) {
    var lr = loads.map(function(e, i) {
      return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(fshClock(e.time)) + fshTd(fshClient(e)) + fshTd(fshPart(e)) +
        fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(e.rework ? 'Yes' : '') + fshTd(fshSource(e)) + '</tr>';
    }).join('');
    if (!filled) lr = fshBlankRows(both ? FSH_LOAD_ROWS_BOTH : FSH_LOAD_ROWS, 8, 1);
    else if (!loads.length) lr = fshBlankRows(1, 8, 1);
    h += (both ? '<div class="inv-as-slot">Into the tank</div>' : '') +
      fshTable(['num', 'time', 'client', 'part', 'qty', 'unit', 'yes', 'note'], ['#', 'Into the tank at', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'Re-pickled', filled ? 'Entered' : 'Note'], lr, ' data-fsh="loads"');
  }
  if (parts.incoming) {
    var ir = ins.map(function(e, i) {
      return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(fshClock(e.time)) + fshTd(fshClient(e)) + fshTd(e.challanNo || '') +
        fshTd(fshPart(e)) + fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(fshSource(e)) + '</tr>';
    }).join('');
    if (!filled) ir = fshBlankRows(both ? FSH_IN_ROWS : FSH_LOAD_ROWS, 8, 1);
    else if (!ins.length) ir = fshBlankRows(1, 8, 1);
    h += (both ? '<div class="inv-as-slot">Material in</div>' : '') +
      fshTable(['num', 'time', 'client', 'challan', 'part', 'qty', 'unit', 'note'], ['#', 'Came in at', 'Client', 'Challan no.', 'Part and gauge', 'Counted', 'NOS / KG', filled ? 'Entered' : 'Note'], ir, ' data-fsh="incoming"');
  }
  h += '<div class="inv-as-note">' + (parts.loads ? 'A load a row, written when it goes into the tank: the client, the part with its gauge where it has more than one, and the pieces or kilos. Tick Re-pickled for work done again: it counts as work, never billed. ' : '') +
    (parts.incoming ? 'Material in: count each line of a challan as it arrives, against the challan where there is one.' : '') + '</div>';
  return h + (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Filled by</div><div>Sent on WhatsApp at</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The barrel batch sheet ---------- */
/* The day's batches as the app counts them (a batch entered on Mine, else the supervisor's list): Production's own figure. */
function fshBatches(iso) { return prodDayLine(iso, 'barrel').entries.slice().sort(fshByTime); }
function fshBarrelHtml(iso, filled) {
  var list = filled ? fshBatches(iso) : [];
  var rows = list.map(function(e, i) {
    return '<tr data-fsh-row="' + escHtml(e.id) + '"><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(e.barrel ? String(e.barrel).replace(/^barrel\s*/i, '') : '') + fshTd(fshClient(e)) +
      fshTd(fshPart(e)) + fshTd(fshQty(e.qty, e.unit)) + fshTd(e.qty == null ? '' : e.unit || '') + fshTd(fshClock(e.time)) + fshTd(fshClock(e.to)) + fshTd(e.rework ? 'Yes' : '') + fshTd(fshSource(e)) + '</tr>';
  }).join('');
  if (!filled) rows = fshBlankRows(FSH_BATCH_ROWS, 10, 1);
  else if (!list.length) rows = fshBlankRows(1, 10, 1);
  return '<div class="inv-as-page" data-sheet="' + (filled ? 'barrel-filled' : 'barrel') + '">' + _asHead(filled ? 'Barrel as entered in the app' : 'Barrel batches', iso, filled ? '' : 'Supervisor') +
    (filled ? '<div class="inv-as-note" data-fsh-from>' + escHtml(list.length ? 'As entered: ' + fshFromLine(list) + '.' : 'Nothing is recorded in the app for this day yet.') + '</div>' : '') +
    fshTable(['num', 'barrel', 'client', 'part', 'qty', 'unit', 'time', 'time', 'yes', 'note'], ['#', 'Barrel', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'In', 'Out', 'Rework', filled ? 'Entered' : 'Note'], rows, ' data-fsh="batches"') +
    '<div class="inv-as-note">A batch a row: the barrel, the client, the part with its gauge, the pieces or kilos, when it went in and when it came out. Tick Rework for work done again: it counts as work, never billed.</div>' +
    (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Filled by the supervisor</div><div>Sent on WhatsApp at</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The VAT register page ---------- */
/* What a line's page holds for the day: the page entered on Mine as it was typed, else the runs the app counts (a photo, a
   message, by hand), a round a row as written. {style, rows: [{time, to, client, part, fig, note}], total, from, n}. */
function fshVatRead(iso, line) {
  var pg = faceVatPage(iso, line);
  if (pg) {
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
  return { style: batches ? 'batches' : faceVatStyleOf(line), rows: rows, total: null, n: rows.length, from: runs.length ? 'As entered: ' + fshFromLine(runs) + '.' : '' };
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
function fshVatHtml(iso, line, filled) {
  var rd = filled ? fshVatRead(iso, line) : { style: faceVatStyleOf(line), rows: [], total: null, from: '' };
  var batches = rd.style === 'batches', label = PROD_LINE_LABEL[line] || line;
  var day = filled ? prodDayLine(iso, line) : null;
  var rows = rd.rows.map(function(r, i) {
    return '<tr><td class="inv-as-tick">' + (i + 1) + '</td>' + fshTd(r.time) + (batches ? fshTd(r.to) : '') + fshTd(r.client) + fshTd(r.part) + fshTd(r.fig) + fshTd(r.note) + '</tr>';
  }).join('');
  var nCols = batches ? 7 : 6;
  if (!filled) rows = fshBlankRows(batches ? FSH_BATCH_PAGE_ROWS : FSH_ROUND_ROWS, nCols, 1);
  else if (!rd.rows.length) rows = fshBlankRows(1, nCols, 1);
  var cols = batches ? ['num', 'time', 'time', 'client', 'part', 'fig2', 'note'] : ['num', 'time', 'client', 'part', 'fig2', 'note'];
  var heads = batches ? ['#', 'Began (START)', 'Ended (END)', 'Client', 'Part', 'Figure as written', 'Note'] : ['#', 'Time', 'Client', 'Part', 'Figure as written', 'Note'];
  var counted = day && (day.nos || day.kgWritten) ? [day.nos ? Math.round(day.nos).toLocaleString('en-IN') + ' NOS' : '', day.kgWritten ? formatNum(day.kgWritten, 0) + ' kg' : ''].filter(Boolean).join(' + ') : '';
  return '<div class="inv-as-page" data-sheet="' + (filled ? 'vat-filled' : 'vat') + '" data-line="' + escHtml(line) + '">' +
    _asHead(escHtml(label) + (filled ? ' register as entered in the app' : ' register'), iso, filled ? '' : 'Register clerk') +
    (filled ? '<div class="inv-as-note" data-fsh-from>' + escHtml(rd.from || 'Nothing is recorded in the app for ' + label + ' on this day yet.') + '</div>' : '') +
    fshTable(cols, heads, rows, ' data-fsh="rounds"', true) +
    '<div class="inv-as-grid">' + _asFillField('Day total written', rd.total != null ? fshQty(+rd.total, 'NOS') : '') + _asFillField('Counted by the app', counted) + '</div>' +
    '<div class="inv-as-slot">Power log</div>' +
    '<table class="inv-as-table" data-as-entry data-fsh="cuts">' + fshCols(['num', 'time', 'time', 'reason', 'note']) +
    '<thead><tr><th class="inv-as-tick">#</th><th>Power cut at</th><th>Power in at</th><th>Why</th><th>Note</th></tr></thead><tbody>' + fshCutsRows(iso, filled) + '</tbody></table>' +
    '<div class="inv-as-note">' + (batches ? 'A batch a row: when it began (START), when it ended (END), and the figure at the end as written (3×156, 98×8+1).' :
      'A round a row: the time and the figure as written (120, 3+4×156, 98×8+1); the app adds it up.') + ' Write the client and the part where a run begins, and " under them while it runs on. Strike a round that did not happen.</div>' +
    (filled ? fshFiledFoot() : '<div class="inv-as-sign"><div>Written by</div><div>Checked by</div><div>Entered in the app by / on</div></div>') + '</div>';
}

/* ---------- The sheets of a face ---------- */
/* Each duty's paper: its blank sheet and the day as entered. A sheet two duties share prints once (the roll's two sides; the
   pickling sheet carries Material in). `has` says whether the day holds anything for it. */
var FSH_SHEETS = [
  { id: 'roll', duties: ['roll-in', 'roll-out'], title: 'The roll, in time and out time',
    blank: function(d) { return attSheetShyamHtml(d); },
    filled: function(d) { return attSheetShyamHtml(d, attDay(d, false), 'As entered in the app.'); },
    has: function(d) { var r = attDay(d, false); return !!(r && Object.keys(r.marks || {}).length); } },
  { id: 'attsheet', duties: ['attsheet'], title: 'The attendance sheet',
    blank: function(d) { return attSheetDeepakHtml(d, false); }, filled: function(d) { return attSheetDeepakHtml(d, true); },
    has: function(d) { var r = attDay(d, false); return !!(r && Object.keys(r.marks || {}).length); } },
  { id: 'pickling', duties: ['pickling', 'incoming'], title: 'The pickling sheet',
    blank: function(d, ds) { return fshPicklingHtml(d, false, fshPicklingParts(ds)); }, filled: function(d, ds) { return fshPicklingHtml(d, true, fshPicklingParts(ds)); },
    has: function(d, ds) { var p = fshPicklingParts(ds); return (p.loads && fshEntries(d, 'pickled').length > 0) || (p.incoming && fshEntries(d, 'arrived').length > 0); } },
  { id: 'stock', duties: ['stock'], title: 'The stock message',
    // As entered: the stock with its bills and prices for a role that sees money, else the supervisor's own sheet filled (a face
    // never prints a money figure its role does not see).
    blank: function(d) { return stockSheetSupHtml(d, false); },
    filled: function(d) { return grdSeesMoney() ? stockSheetDeepakHtml(d, true) : stockSheetSupHtml(d, true, 'As entered in the app.'); },
    has: function(d) { return (stockData().entries || []).some(function(e) { return e && e.date === d && !e.voided; }); } },
  { id: 'barrel', duties: ['barrel'], title: 'The barrel batch sheet',
    blank: function(d) { return fshBarrelHtml(d, false); }, filled: function(d) { return fshBarrelHtml(d, true); },
    has: function(d) { return fshBatches(d).length > 0; } },
  { id: 'vat', duties: ['vat'], title: 'The VAT register pages',
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
  fshShow(list.map(function(x) { return x.s[kind === 'filled' ? 'filled' : 'blank'](day, x.duties); }).join(''), (kind === 'filled' ? 'As entered ' : 'Sheets ') + day);
}
/* The print view, as the other sheets open it. */
function fshShow(html, title) {
  document.getElementById('invPrintBody').innerHTML = html;
  document.getElementById('invPrintView').classList.add('inv-print-view-active');
  _printInvId = null;
  printFit();
  document.body.style.overflow = 'hidden';
  document._savedTitle = document.title;
  document.title = title;
}

/* ---------- Production → More → Print sheets: any day, the floor's three ---------- */
var FSH_PROD = [['pickling', 'Pickling sheet', 'loads into the tank, and material in'], ['barrel', 'Barrel batches', 'a batch a row: barrel, client, part, in and out'],
  ['vat-a1', 'VAT A1 register page', 'a round a row'], ['vat-a2', 'VAT A2 register page', 'a batch a row: began and ended']];
function fshProdOpen() {
  if (!_fshDay) _fshDay = localDateStr();
  dialogOpen('<div class="inv-dialog">' + dialogHeadHtml('Print sheets') +
    '<div class="inv-field"><label class="inv-field-label" for="fshDate">Day</label><input type="date" id="fshDate" class="inv-input" data-nodirty max="' + escHtml(localDateStr()) + '" value="' + escHtml(_fshDay) + '"></div>' +
    '<div class="inv-field">' + FSH_PROD.map(function(x) {
      return '<label class="inv-field-check"><input type="checkbox" class="inv-check" data-fsh-pick="' + x[0] + '"' + (_fshPick[x[0]] ? ' checked' : '') + '><span>' + x[1] + ' <span class="inv-note">' + x[2] + '</span></span></label>';
    }).join('') + '</div>' +
    '<div class="inv-field-hint">Blank, to fill by hand; or as entered for the day, to file (a sheet with nothing entered is left out).</div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-secondary" data-action="invCloseOverlay">Cancel</button>' +
    '<button class="inv-btn inv-btn-secondary" data-action="invFshPreview" data-kind="filled">As entered</button>' +
    '<button class="inv-btn inv-btn-primary" data-action="invFshPreview" data-kind="blank">Blank</button></div></div>', { dismiss: true });
}
function fshProdPreview(kind) {
  var d = document.getElementById('fshDate');
  if (d && d.value) _fshDay = d.value;
  document.querySelectorAll('[data-fsh-pick]').forEach(function(el) { _fshPick[el.dataset.fshPick] = el.checked; });
  var day = _fshDay || localDateStr(), filled = kind === 'filled', h = '', left = [];
  FSH_PROD.forEach(function(x) {
    if (!_fshPick[x[0]]) return;
    var line = x[0].indexOf('vat-') === 0 ? x[0] : null;
    var has = x[0] === 'pickling' ? fshEntries(day, 'pickled').length + fshEntries(day, 'arrived').length > 0 : x[0] === 'barrel' ? fshBatches(day).length > 0 : fshVatHas(day, line);
    if (filled && !has) { left.push(x[1]); return; }
    h += x[0] === 'pickling' ? fshPicklingHtml(day, filled) : x[0] === 'barrel' ? fshBarrelHtml(day, filled) : fshVatHtml(day, line, filled);
  });
  if (!h) { showToast(filled && left.length ? 'Nothing is entered on ' + formatDate(day) + ' for ' + left.join(', ') : 'Pick at least one sheet', 'error'); return; }
  closeOverlay();
  fshShow(h, (filled ? 'Production as entered ' : 'Production sheets ') + day);
  if (left.length) showToast('Left out, nothing entered: ' + left.join(', '), 'warning');
}
