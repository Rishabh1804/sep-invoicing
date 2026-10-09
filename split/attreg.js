/* ===== THE MONTHLY REGISTER — the attendance book kept by hand, set against the day =====
   Staff → Register (owner, 6 Oct 2026: "that's what I receive at the end of every month to make the attendance slips … I need
   this to be in the app … from next month I can start entering these into the app and cross check against the daily
   attendance that we receive and update"). The supervisor keeps a book: a page a month, a column a monthly hand, a row a day,
   each cell the shop's notation (P, A, H, "P-8pm", "6Am-5pm", a Sunday line spelt across the columns) and an OT total under
   the column. It is the paper the slips are made from.

   The page is kept as written (`S.attRegister.months[YYYY-MM]`: its columns as headed, each day's cells as raw text) and read
   in code (`aregCell`), never stored read: a transcription, never a reading (the production register's rule). Each cell is set
   against the day as the app holds it (`S.attendance`) and said: agrees, differs, OT differs, only on the register, only on
   the day. A day the app never held is filled from the register only on the owner's word (Fill), and a difference is settled
   one cell at a time, either way (the day takes the register's, or the register cell is corrected). A corrected cell keeps
   what it said (`edits`). Each column's written total is set against the cells' own sum.

   The hours rule is the roll's (`relayHoursOf`: the clock span to the whole hour, OT the hours past 8; a plain P is the shift,
   8:30 AM to 5:00 PM). Measured on the book's March page, it reproduces every written OT total to the hour. A Sunday or holiday
   worked is hours of its own: the August page's totals add them in, March's had none to add. Names in the build: none; the
   pages arrive by import (`sep-att-register`), a photo read by Gemini, or by hand. */

var _aregMonth = null;   // 'YYYY-MM' on show
var _aregCellAt = null;  // { d: day index, c: column index } in the cell dialog

function aregData() {
  if (!S.attRegister || typeof S.attRegister !== 'object') S.attRegister = { months: {}, names: {} };
  if (!S.attRegister.months) S.attRegister.months = {};
  if (!S.attRegister.names) S.attRegister.names = {};
  return S.attRegister;
}
/* The register is read wherever it is drawn: reading never writes (the change log, P141). */
function aregMonths() { return (S.attRegister && S.attRegister.months) || {}; }
function aregMonthOf(month) { return aregMonths()[month] || null; }
function aregMonthShown() {
  if (!_aregMonth) {
    var have = Object.keys(aregMonths()).sort();
    _aregMonth = have.length ? have[have.length - 1] : localDateStr().slice(0, 7);
  }
  return _aregMonth;
}
function aregMonthLabel(month) { return attParseIso(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' }); }
function aregDaysIn(month) { var d = attParseIso(month + '-01'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

/* ===== A CELL, READ =====
   "P", "A", "H" (half day on a working day), "p-8pm" (from the shift's start to 8 PM), "6am-5pm", "6am" (from 6 AM to the
   shift's end), "6am-12am" (to midnight), "p-6am" (overnight), "8:30am-2pm". A dash or a blank is nothing. On a Sunday or
   holiday line the letters spelt across the columns (S U N D A Y, H O L I D A Y) are the line, not marks: an A there is the
   word's, never an absence. Returns null for nothing, else {st, inMin, outMin, unread}. */
var AREG_START = 510, AREG_END = 1020;   // 8:30 AM and 5:00 PM, the general shift (relay.js's RELAY_GENERAL)
function aregClock(s) {
  if (s === 'p') return AREG_START;
  var m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(s);
  if (!m) return null;
  var h = +m[1], mi = +(m[2] || 0);
  if (h > 24 || mi > 59) return null;
  if (m[3] === 'am' && h === 12) h = 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  return h * 60 + mi;
}
function aregCell(raw, kind) {
  var r = String(raw == null ? '' : raw).toLowerCase().replace(/\s+/g, '').replace(/[.:,]+$/, '');
  if (!r || /^[-—–_~]+$/.test(r)) return null;
  if (kind && kind !== 'work' && (/^[sundayholi]$/.test(r) || /^(sunday|holiday|holyday)$/.test(r))) return null;
  if (r === 'p' || r === 'a' || r === 'h') return { st: r.toUpperCase() };
  r = r.split('/')[0];
  var span = /^([^-]+)-(.*)$/.exec(r);
  if (span) {
    var a = aregClock(span[1]), b = span[2] ? aregClock(span[2]) : null;
    if (a == null || (span[2] && b == null) || !span[2]) return { st: 'P', inMin: a, outMin: null, unread: true };
    if (b <= a) b += 1440;
    return { st: 'P', inMin: a, outMin: b };
  }
  var one = aregClock(r);
  if (one != null) return { st: 'P', inMin: one, outMin: null };
  return { st: null, unread: true };
}
/* What a read cell came to: the hours of the span and the OT past 8, by the roll's rule. A half day is four hours. */
function aregHours(c, w) {
  if (!c || c.st === 'A' || !c.st) return { hours: 0, ot: 0 };
  if (c.st === 'H') return { hours: 4, ot: 0 };
  var a = c.inMin != null ? c.inMin : AREG_START;
  var b = c.outMin != null ? c.outMin : AREG_END;
  if (b <= a) b += 1440;
  return relayHoursOf(a, b, w, null);
}
/* A cell said short on the grid: P, A, H, or the span ("6a–8p"). */
function aregShort(c) {
  if (!c) return '';
  if (!c.st) return '?';
  if (c.st !== 'P' || (c.inMin == null && c.outMin == null)) return c.st;
  var t = function(min) {
    if (min == null) return '';
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), mi = min % 60, ap = h >= 12 ? 'p' : 'a';
    h = h % 12 || 12;
    return h + (mi ? ':' + String(mi).padStart(2, '0') : '') + ap;
  };
  return (c.inMin === AREG_START ? 'P' : t(c.inMin)) + '–' + (c.outMin == null ? '' : t(c.outMin));
}

/* ===== A COLUMN'S WORKER =====
   By the column's own pick, else a spelling learnt from an earlier pick, else the roster's name as a roll reads it
   (payrollMatch: the roster name, a spelling kept on the worker, a first name nobody else has), only when sure. */
function aregNameKey(name) { return relayKey(String(name || '')); }
function aregColWorker(mo, i) {
  var col = mo && mo.columns[i];
  if (!col) return null;
  if (col.staffId != null) return staffById(col.staffId) || null;
  var k = aregNameKey(col.name), learnt = k && S.attRegister && S.attRegister.names ? S.attRegister.names[k] : null;
  if (learnt != null && staffById(learnt)) return staffById(learnt);
  return typeof payrollWorker === 'function' ? payrollWorker({ name: col.name }) : null;
}

/* ===== THE REGISTER AGAINST THE DAY =====
   Per cell: 'agree', 'state' (present, half or absent differ), 'ot' (both present, the OT a whole hour or more apart),
   'reg' (on the register, no mark on the day), 'day' (a present mark on the day, nothing on the register), or nothing. A
   column with no worker is not compared. */
function aregCompare(mo) {
  var out = { cells: {}, n: { agree: 0, state: 0, ot: 0, reg: 0, day: 0 }, unsure: 0, unread: 0, cols: [] };
  if (!mo) return out;
  var ws = mo.columns.map(function(c, i) { return aregColWorker(mo, i); });
  out.cols = mo.columns.map(function(col, i) { return { name: col.name, w: ws[i], total: col.total || '', ot: 0, off: 0, dayOt: 0, unsure: 0 }; });
  mo.days.forEach(function(day, di) {
    var rec = day.date && S.attendance ? S.attendance[day.date] : null;
    (day.cells || []).forEach(function(cell, ci) {
      var col = out.cols[ci];
      if (!col) return;
      var c = aregCell(cell.raw, day.kind), w = ws[ci], h = aregHours(c, w);
      if (cell.unsure) { out.unsure++; col.unsure++; }
      if (c && c.unread) out.unread++;
      if (c && c.st === 'P') { if (day.kind === 'work') col.ot += h.ot; else col.off += h.hours; }
      if (!w || !day.date) return;
      var m = rec && rec.marks ? rec.marks[w.id] : null;
      if (m && (m.st === 'P' || m.st === 'H')) col.dayOt += Number(m.ot) || 0;
      var k = null;
      if (c && c.st && !m) k = 'reg';
      else if (m && !(c && c.st)) k = m.st === 'P' || m.st === 'H' ? 'day' : null;
      else if (c && c.st && m) k = c.st !== m.st ? 'state' : c.st === 'P' && Math.abs(h.ot - (Number(m.ot) || 0)) >= 1 ? 'ot' : 'agree';
      if (!k) return;
      out.cells[di + ':' + ci] = { k: k, c: c, m: m, h: h, w: w };
      out.n[k]++;
    });
  });
  return out;
}
/* A written total ("OT-89", "103 Hrs", "OT-2 Hrs") as a number, or null. */
function aregTotalNum(raw) { var m = /(\d+(?:\.\d+)?)/.exec(String(raw || '')); return m ? +m[1] : null; }

/* ===== THE SCREEN ===== */
var AREG_TONE = { agree: 'ok', state: 'danger', ot: 'warning', reg: '', day: 'warning' };
var AREG_SAY = { agree: 'Agrees with the day', state: 'Differs from the day', ot: 'OT differs from the day', reg: 'Only on the register', day: 'Only on the day' };

function aregViewHtml() {
  var month = aregMonthShown(), mo = aregMonthOf(month);
  var html = _attStepper('invAregStep', _attWeekLabel(escHtml(aregMonthLabel(month)), mo ? escHtml(aregSourceText(mo)) : 'Not on record'),
    'invAregNow', 'This month', 'Previous month', 'Next month');
  var cmp = aregCompare(mo);
  // One primary: start the page, else fill the days the app never held, else mark the month checked.
  var primary = !mo ? '<button class="inv-btn inv-btn-primary" data-action="invAregStart">Start this month</button>'
    : cmp.n.reg ? '<button class="inv-btn inv-btn-primary" data-action="invAregFill">Fill ' + cmp.n.reg + ' from the register</button>'
    : !mo.verifiedAt ? '<button class="inv-btn inv-btn-primary" data-action="invAregVerify">Mark checked</button>' : '';
  html += '<div class="inv-toolbar">' + primary +
    '<button class="inv-btn" data-action="invAregPhoto">Read page photo</button>' +
    '<button class="inv-btn inv-btn-ghost" data-action="invAregImport">Import</button>' +
    '<input type="file" id="aregFile" accept=".json,application/json" hidden>' +
    '<input type="file" id="aregPhotoFile" accept="image/*" hidden></div>';
  if (!mo) {
    return html + '<div class="inv-panel"><div class="inv-panel-body inv-note">No register page for ' + escHtml(aregMonthLabel(month)) + '. ' +
      '<b>Start this month</b> draws an empty page with a column for each monthly hand, to fill from the book as it is written; ' +
      '<b>Read page photo</b> reads a photo of the page with Gemini, every cell shown before it counts; <b>Import</b> takes a ' +
      '<code>sep-att-register</code> file. Each cell is then set against the day as the app holds it.</div></div>';
  }
  html += aregSummaryHtml(mo, cmp) + aregGridHtml(mo, cmp) + aregDiffHtml(mo, cmp) + uiFoldCard('aregTotals', aregTotalsHtml(mo, cmp), true);
  if ((mo.notes || []).length) {
    html += uiFoldCard('aregNotes', '<div class="inv-panel inv-panel-flush" data-card="areg-notes"><div class="inv-panel-head"><span class="inv-panel-title">Notes on the page</span></div>' +
      mo.notes.map(function(n) { return '<div class="inv-row"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(n) + '</span></span></div>'; }).join('') + '</div>', false);
  }
  return html;
}
function aregSourceText(mo) {
  var src = mo.src === 'photo' ? 'read from a photo' : mo.src === 'hand' ? 'entered by hand' : 'imported';
  return src + (mo.verifiedAt ? ' · checked ' + formatDate(isoOf(new Date(mo.verifiedAt))) : ' · not yet checked');
}
function aregSummaryHtml(mo, cmp) {
  var n = cmp.n, cols = cmp.cols.filter(function(c) { return !c.w; }).length;
  var h = '<div class="inv-panel inv-panel-flush" data-card="areg-summary" id="aregSummary"><div class="inv-tiles inv-tiles-flush">' +
    statsTile('agree', 'Agree with the day', String(n.agree), statsTileSub('present, half or absent alike, OT within an hour'), n.agree ? 'ok' : null) +
    statsTile('differ', 'Differ', String(n.state + n.ot), statsTileSub(n.state + ' on the mark · ' + n.ot + ' on the OT'), n.state ? 'danger' : n.ot ? 'warning' : null) +
    statsTile('reg', 'Only on the register', String(n.reg), statsTileSub('days the app holds no mark for'), null) +
    statsTile('unsure', 'To check', String(cmp.unsure + cmp.unread + cols),
      statsTileSub(cmp.unsure + ' cell' + (cmp.unsure === 1 ? '' : 's') + ' unsure · ' + cmp.unread + ' unread · ' + cols + ' column' + (cols === 1 ? '' : 's') + ' with no worker'),
      cmp.unsure + cmp.unread + cols ? 'warning' : null) + '</div>';
  if (n.day) h += _labNote(n.day + ' present mark' + (n.day === 1 ? '' : 's') + ' on the day with nothing on the register: a hand marked on the day the book left blank.');
  return h + '</div>';
}
function aregGridHtml(mo, cmp) {
  var today = localDateStr();
  var h = '<div class="inv-panel inv-panel-flush" data-card="areg-grid" id="aregGrid"><div class="inv-panel-head"><span class="inv-panel-title">The page</span></div>' +
    _labNote('Each cell as written, coloured by the day as the app holds it: green agrees, red differs, amber the OT differs, plain only on the register. A dashed edge is a cell the reading was unsure of. Tap a cell to see both and settle it.') +
    '<div class="inv-scroll-x"><table class="inv-table inv-table-grid"><thead><tr><th scope="col">Day</th>' +
    mo.columns.map(function(col, i) {
      var w = cmp.cols[i].w;
      return '<th scope="col"><button class="inv-btn inv-btn-link inv-btn-sm" data-action="invAregCol" data-c="' + i + '" title="' + escHtml(w ? col.name + ' is ' + w.name : col.name + ': no worker yet') + '">' +
        escHtml(col.name) + '</button><span class="inv-table-grid-date">' + (w ? escHtml(w.name.split(/[\s\-–(]/)[0]) : 'pick') + '</span></th>';
    }).join('') + '</tr></thead><tbody>';
  mo.days.forEach(function(day, di) {
    var off = day.kind !== 'work';
    h += '<tr' + (off ? ' data-sun' : '') + '><th scope="row"' + (day.date === today ? ' aria-current="date"' : '') + '>' +
      escHtml(day.date ? attDayName(day.date) + ' ' + attParseIso(day.date).getDate() : (day.written || '?')) +
      (off ? '<span class="inv-table-grid-date">' + (day.kind === 'holiday' ? 'holiday' : 'Sunday') + '</span>' : '') + '</th>';
    (day.cells || []).forEach(function(cell, ci) {
      var x = cmp.cells[di + ':' + ci], c = x ? x.c : aregCell(cell.raw, day.kind);
      var tone = x ? AREG_TONE[x.k] : '';
      var label = c ? aregShort(c) : (off ? '' : '&middot;');
      h += '<td' + (off ? ' data-sun' : '') + '><button class="inv-cell' + (tone ? ' inv-cell-' + tone : c ? '' : ' inv-cell-empty') + '" data-action="invAregCell" data-d="' + di + '" data-c="' + ci + '"' +
        (cell.unsure || (c && c.unread) ? ' data-unsure' : '') +
        ' aria-label="' + escHtml((mo.columns[ci] || {}).name + ', ' + (day.date ? formatDate(day.date) : day.written) + ': ' + (cell.raw || 'blank') + (x ? ', ' + AREG_SAY[x.k] : '')) + '">' +
        (c ? escHtml(label) : label) + '</button></td>';
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div></div>';
}
function aregDiffHtml(mo, cmp) {
  var rows = [];
  mo.days.forEach(function(day, di) {
    (day.cells || []).forEach(function(cell, ci) {
      var x = cmp.cells[di + ':' + ci];
      if (!x || x.k === 'agree' || x.k === 'reg') return;
      rows.push('<button class="inv-row inv-row-2" data-action="invAregCell" data-d="' + di + '" data-c="' + ci + '" data-areg-diff="' + x.k + '">' +
        '<span class="inv-row-main"><span class="inv-row-title">' + escHtml(x.w.name) + ' · ' + escHtml(formatDate(day.date)) + '</span>' +
        '<span class="inv-row-meta inv-row-wrap">Register &ldquo;' + escHtml(cell.raw || 'blank') + '&rdquo;' + (x.c && x.c.st === 'P' ? ', OT ' + x.h.ot + ' h' : '') +
        ' · the day ' + escHtml(x.m ? ATT_STATE_LABELS[x.m.st] || x.m.st : 'no mark') + (x.m && x.m.st === 'P' ? ', OT ' + formatNum(Number(x.m.ot) || 0, 1) + ' h' : '') + '</span></span>' +
        '<span class="inv-row-end"><span class="inv-dot inv-dot-' + AREG_TONE[x.k] + '">' + AREG_SAY[x.k].replace(' from the day', '') + '</span></span></button>');
    });
  });
  var h = '<div class="inv-panel inv-panel-flush" data-card="areg-diff"><div class="inv-panel-head"><span class="inv-panel-title">Where the register and the day differ</span>' +
    '<span class="inv-num">' + rows.length + '</span></div>';
  if (!rows.length) return h + _labNote(cmp.n.agree ? 'Every cell the day also holds agrees with it.' : 'The app holds no day of this month for these hands yet.') + '</div>';
  return h + uiMoreHtml('areg-diff-' + mo.month, rows, { n: 10, noun: 'cells' }) + '</div>';
}
function aregTotalsHtml(mo, cmp) {
  var h = '<div class="inv-panel inv-panel-flush" data-card="areg-totals"><div class="inv-panel-head"><span class="inv-panel-title">OT by column</span></div>';
  cmp.cols.forEach(function(col) {
    var written = aregTotalNum(col.total), both = col.ot + col.off;
    var tone = written == null ? '' : written === col.ot || written === both ? 'ok' : 'warning';
    var say = written == null ? 'no total written'
      : written === col.ot ? 'matches the cells' : written === both ? 'matches with the Sunday and holiday hours' : 'the cells come to ' + col.ot + (col.off ? ' (' + both + ' with Sundays)' : '');
    h += _payRow(escHtml(col.name) + (col.w ? ' · ' + escHtml(col.w.name) : ''),
      'cells: OT ' + col.ot + ' h' + (col.off ? ' · Sunday and holiday ' + col.off + ' h' : '') + (col.w ? ' · the day: OT ' + formatNum(col.dayOt, 1) + ' h' : '') +
        (col.total ? ' · written &ldquo;' + escHtml(col.total) + '&rdquo;' : ''),
      written == null ? '<span class="inv-unit">&mdash;</span>' : '<span class="inv-dot inv-dot-' + tone + '">' + say + '</span>');
  });
  return h + _labNote('A cell&rsquo;s OT is its span to the whole hour less 8, the rule a roll is read by; a plain P is the shift, 8:30 AM to 5:00 PM. A Sunday or holiday worked is counted apart: some months&rsquo; totals add it in.') + '</div>';
}

/* ===== THE CELL ===== */
function aregCellHtml() {
  var mo = aregMonthOf(aregMonthShown()), at = _aregCellAt;
  var day = mo && at ? mo.days[at.d] : null, cell = day ? day.cells[at.c] : null, col = mo && at ? mo.columns[at.c] : null;
  if (!cell) return '';
  var w = aregColWorker(mo, at.c), c = aregCell(cell.raw, day.kind), hh = aregHours(c, w);
  var m = w && day.date ? attMark(day.date, w.id) : null;
  var x = aregCompare(mo).cells[at.d + ':' + at.c];
  var read = !c ? 'Nothing' + (day.kind !== 'work' ? ' (the ' + (day.kind === 'holiday' ? 'holiday' : 'Sunday') + ' line)' : '')
    : !c.st ? 'Not read: type it as P, A, H or a span such as 6am-5pm'
    : c.st === 'P' ? 'Present' + (c.inMin != null || c.outMin != null ? ', ' + relayClockLabel(c.inMin != null ? c.inMin : AREG_START) + ' – ' + (c.outMin != null ? relayClockLabel(c.outMin % 1440) : 'shift end') : '') + ' · ' + hh.hours + ' h, OT ' + hh.ot + ' h'
    : ATT_STATE_LABELS[c.st];
  var dayTxt = !w ? 'No worker for this column yet: pick one from its head.'
    : !m ? 'No mark on ' + formatDate(day.date) + '.'
    : ATT_STATE_LABELS[m.st] + (m.st === 'P' ? ', ' + formatNum(Number(m.hours) || 0, 1) + ' h, OT ' + formatNum(Number(m.ot) || 0, 1) + ' h' : '') + (attTimesText(m) ? ' · ' + attTimesText(m) : '') + (m.src === 'register' ? ' · from the register' : '');
  var canPut = w && day.date && c && c.st && !c.unread && x && (x.k === 'reg' || x.k === 'state' || x.k === 'ot');
  var canCopy = w && day.date && m && x && (x.k === 'state' || x.k === 'ot' || x.k === 'day');
  var next = aregNextCell(mo, at);
  return '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="aregCellT" data-areg-cell>' +
    dialogHeadHtml('<span id="aregCellT">' + escHtml((col.name || '') + (w ? ' · ' + w.name : '') + ' · ' + (day.date ? attDayName(day.date) + ' ' + formatDate(day.date) : day.written)) + '</span>', 'invAregCellClose') +
    '<div class="inv-dialog-body" data-nodirty>' +
    '<div class="inv-field"><span class="inv-field-label">Quick</span><span class="inv-seg" role="group" aria-label="Quick">' +
    ['P', 'H', 'A'].map(function(s) { return '<button class="inv-seg-btn inv-seg-btn-' + ATT_STATE_TONE[s] + '" data-action="invAregQuick" data-v="' + s + '" aria-pressed="' + (c && c.st === s && c.inMin == null && c.outMin == null) + '">' + ATT_STATE_LABELS[s] + '</button>'; }).join('') +
    '<button class="inv-seg-btn" data-action="invAregQuick" data-v="" aria-pressed="' + !c + '">Blank</button></span></div>' +
    '<label class="inv-field"><span class="inv-field-label">As written</span><input class="inv-input" data-areg-raw value="' + escHtml(cell.raw || '') + '" placeholder="P, A, H, 6am-5pm, p-8pm" autocomplete="off"></label>' +
    '<div class="inv-rows">' +
    _payRow('The register reads', escHtml(read), cell.unsure ? '<span class="inv-dot inv-dot-warning">Unsure</span>' : '') +
    _payRow('The day holds', escHtml(dayTxt), x ? '<span class="inv-dot inv-dot-' + (AREG_TONE[x.k] || 'info') + '">' + AREG_SAY[x.k] + '</span>' : '') +
    ((cell.edits || []).length ? _payRow('Corrected', cell.edits.map(function(e) { return '&ldquo;' + escHtml(e.from || 'blank') + '&rdquo; → &ldquo;' + escHtml(e.to || 'blank') + '&rdquo; ' + escHtml(formatDate(isoOf(new Date(e.at)))); }).join(' · '), '') : '') +
    '</div>' +
    (day.note ? '<div class="inv-note">' + escHtml(day.note) + '</div>' : '') + '</div>' +
    '<div class="inv-dialog-foot">' +
    (canCopy ? '<button class="inv-btn" data-action="invAregFromDay">Register takes the day&rsquo;s</button>' : '') +
    (canPut ? '<button class="inv-btn" data-action="invAregToDay">Day takes the register&rsquo;s</button>' : '') +
    (cell.unsure ? '<button class="inv-btn" data-action="invAregSure">Reads right</button>' : '') +
    (next ? '<button class="inv-btn inv-btn-primary" data-action="invAregNext">Next day</button>' : '<button class="inv-btn inv-btn-primary" data-action="invAregCellClose">Done</button>') +
    '</div></div>';
}
function aregNextCell(mo, at) {
  for (var d = at.d + 1; d < mo.days.length; d++) if (mo.days[d].kind === 'work' && mo.days[d].cells[at.c]) return { d: d, c: at.c };
  return null;
}
function aregCellOpen(d, c) { _aregCellAt = { d: d, c: c }; dialogOpen(aregCellHtml()); }
function aregCellRedraw() {
  var scrim = document.querySelector('.inv-scrim-dialog [data-areg-cell]');
  scrim = scrim && scrim.closest('.inv-scrim-dialog');
  if (scrim) scrim.innerHTML = aregCellHtml();
  renderAttendance();
}
/* A cell typed or corrected: what it said before is kept on it. A cell read from paper and changed is a correction; a cell
   on a page being entered by hand is just being written. */
function aregSetRaw(raw) {
  if (!attFloorOk()) return false;
  var mo = aregMonthOf(aregMonthShown()), at = _aregCellAt;
  var cell = mo && at && mo.days[at.d] ? mo.days[at.d].cells[at.c] : null;
  if (!cell) return false;
  raw = String(raw == null ? '' : raw).trim();
  if (raw === (cell.raw || '')) return false;
  if (mo.src !== 'hand') (cell.edits = cell.edits || []).push({ at: Date.now(), by: aregWho(), from: cell.raw || '', to: raw });
  cell.raw = raw;
  delete cell.unsure;
  delete mo.verifiedAt;
  saveState();
  return true;
}
function aregWho() { var u = typeof grdUser === 'function' ? grdUser() : null; return u ? u.name || '' : ''; }

/* The day takes the register's: the mark set as the cell reads, the times with it, the area kept (a new mark stands at the
   hand's own area). Never on a column with no worker, an unread cell or a blank one. */
function aregPutOnDay(mo, di, ci, w) {
  var day = mo.days[di], cell = day && day.cells[ci], c = cell ? aregCell(cell.raw, day.kind) : null;
  if (!w || !day.date || !c || !c.st || c.unread) return false;
  var rec = attDay(day.date, true);
  var m = rec.marks[w.id] || { area: w.area || 'flex' };
  m.st = c.st;
  delete m.inMin; delete m.outMin;
  if (c.st === 'A') { m.hours = 0; m.ot = 0; }
  else if (c.st === 'H') { m.hours = 4; m.ot = 0; }
  else {
    if (c.inMin != null) m.inMin = c.inMin;
    if (c.outMin != null) m.outMin = c.outMin;
    if (c.inMin == null && c.outMin == null) { m.hours = 8; m.ot = 0; } else attTimesApply(m, w);
  }
  if (!m.area || m.st === 'A') m.area = m.st === 'A' ? (m.area || 'flex') : (w.area || 'flex');
  m.src = 'register';
  rec.marks[w.id] = m;
  return true;
}
/* The register takes the day's: the cell is corrected to what the day holds, written as the shop writes it. */
function aregRawOf(m) {
  if (!m || !m.st) return '';
  if (m.st !== 'P' || (m.inMin == null && m.outMin == null)) return m.st;
  var t = function(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), mi = min % 60, ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + (mi ? ':' + String(mi).padStart(2, '0') : '') + ap;
  };
  return (m.inMin == null || m.inMin === AREG_START ? 'p' : t(m.inMin)) + '-' + (m.outMin == null ? '5pm' : t(m.outMin));
}

/* Fill: every cell only on the register goes onto its day, on the owner's word, with the count said first. */
async function aregFill() {
  if (!attFloorOk()) return;
  var month = aregMonthShown(), mo = aregMonthOf(month), cmp = aregCompare(mo);
  if (!mo || !cmp.n.reg) return;
  var ok = await uiConfirm({ title: 'Fill ' + cmp.n.reg + ' marks from the register?',
    body: 'Each cell the register holds and the app has no mark for goes onto its day, with its times, marked as from the register. A mark already on a day is left as it is; a cell still unsure or unread is left out. This changes the labour figures for ' + aregMonthLabel(month) + '.',
    okLabel: 'Fill from the register' });
  if (!ok) return;
  var n = 0, skipped = 0;
  Object.keys(cmp.cells).forEach(function(key) {
    var x = cmp.cells[key];
    if (x.k !== 'reg') return;
    var p = key.split(':'), cell = mo.days[+p[0]].cells[+p[1]];
    if (cell.unsure || (x.c && x.c.unread)) { skipped++; return; }
    if (aregPutOnDay(mo, +p[0], +p[1], x.w)) n++;
  });
  mo.filledAt = Date.now();
  saveState();
  renderAttendance();
  showToast(n + ' mark' + (n === 1 ? '' : 's') + ' filled' + (skipped ? ' · ' + skipped + ' unsure left out' : ''));
}
async function aregVerify() {
  var mo = aregMonthOf(aregMonthShown());
  if (!mo || !attFloorOk()) return;
  var cmp = aregCompare(mo), open = cmp.unsure + cmp.unread + cmp.n.state;
  if (open) {
    var ok = await uiConfirm({ title: 'Mark checked with cells still open?', body: cmp.unsure + ' unsure, ' + cmp.unread + ' unread and ' + cmp.n.state + ' differing from the day. Marking the page checked says you have looked at it as it is.', okLabel: 'Mark checked' });
    if (!ok) return;
  }
  mo.verifiedAt = Date.now();
  mo.verifiedBy = aregWho();
  saveState();
  renderAttendance();
  showToast(aregMonthLabel(mo.month) + ' marked checked');
}

/* ===== A PAGE STARTED BY HAND =====
   A column for each active monthly hand in the roster's order, a row for each day, Sundays drawn as the Sunday line. */
function aregBlankMonth(month, src) {
  var hands = staffActive().filter(function(w) { return w.comp === 'monthly'; });
  var n = aregDaysIn(month), days = [];
  for (var i = 1; i <= n; i++) {
    var iso = month + '-' + String(i).padStart(2, '0');
    var sun = attParseIso(iso).getDay() === 0;
    days.push({ date: iso, kind: sun ? 'sunday' : 'work', cells: hands.map(function() { return { raw: '' }; }) });
  }
  return { month: month, src: src || 'hand', at: Date.now(), by: aregWho(),
    columns: hands.map(function(w) { return { name: w.name, staffId: w.id }; }), days: days, notes: [] };
}
function aregStart() {
  if (!attFloorOk()) return;
  var month = aregMonthShown();
  if (aregMonthOf(month)) return;
  var mo = aregBlankMonth(month, 'hand');
  if (!mo.columns.length) { uiAlert({ title: 'No monthly hands on the roster', body: 'The register has a column for each monthly hand. Add them on Roster first, or import a page.' }); return; }
  aregData().months[month] = mo;
  saveState();
  renderAttendance();
}

/* ===== A COLUMN'S WORKER, PICKED ===== */
function aregColHtml(ci) {
  var mo = aregMonthOf(aregMonthShown()), col = mo && mo.columns[ci];
  if (!col) return '';
  var w = aregColWorker(mo, ci);
  return '<div class="inv-dialog" role="dialog" aria-modal="true" aria-labelledby="aregColT" data-areg-col="' + ci + '">' +
    dialogHeadHtml('<span id="aregColT">Column &ldquo;' + escHtml(col.name) + '&rdquo;</span>') +
    '<div class="inv-dialog-body"><label class="inv-field"><span class="inv-field-label">Worker</span><select class="inv-select" data-areg-pick="' + ci + '">' +
    '<option value="">No worker</option>' + (S.staff || []).map(function(x) {
      return '<option value="' + escHtml(x.id) + '"' + (w && String(w.id) === String(x.id) ? ' selected' : '') + '>' + escHtml(x.name + (x.active === false ? ' (left)' : '')) + '</option>';
    }).join('') + '</select></label>' +
    '<div class="inv-note">The pick is kept for this spelling, so the next page headed &ldquo;' + escHtml(col.name) + '&rdquo; finds the same hand.</div></div>' +
    '<div class="inv-dialog-foot"><button class="inv-btn inv-btn-primary" data-action="invCloseOverlay">Done</button></div></div>';
}
function aregPickCol(ci, staffId) {
  if (!attFloorOk()) return;
  var mo = aregMonthOf(aregMonthShown()), col = mo && mo.columns[ci];
  if (!col) return;
  var k = aregNameKey(col.name);
  if (staffId === '' || staffId == null) { delete col.staffId; if (k) delete aregData().names[k]; }
  else { col.staffId = staffId; if (k) aregData().names[k] = staffId; }
  saveState();
  renderAttendance();
}

/* ===== IMPORT (sep-att-register v1) =====
   {kind: 'sep-att-register', version: 1, months: [{month, title, columns: [names], days: [{date, written, kind, dateUnsure,
   cells: [{raw, unsure}], note}], totals: [{col, raw}], notes}]}: the transcription's own shape. A month already on record is
   kept and counted, never replaced: a page somebody has worked through is not written over by a file. */
function aregCleanMonth(m, src) {
  if (!m || !/^\d{4}-\d{2}$/.test(m.month || '') || !Array.isArray(m.columns) || !Array.isArray(m.days)) return null;
  var columns = m.columns.map(function(c) { return { name: String((c && c.name) != null ? c.name : c || '').trim() }; });
  if (!columns.length) return null;
  (m.totals || []).forEach(function(t) { if (t && columns[t.col]) columns[t.col].total = String(t.raw || ''); });
  var days = m.days.map(function(d) {
    var date = d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && d.date.slice(0, 7) === m.month ? d.date : null;
    var kind = d && (d.kind === 'sunday' || d.kind === 'holiday') ? d.kind : 'work';
    var cells = columns.map(function(c, i) {
      var x = d && Array.isArray(d.cells) ? d.cells[i] : null;
      var o = { raw: String(x && x.raw != null ? x.raw : x && typeof x === 'string' ? x : '').slice(0, 40) };
      if (x && x.unsure) o.unsure = true;
      return o;
    });
    var o = { date: date, written: String((d && d.written) || '').slice(0, 20), kind: kind, cells: cells };
    if (d && d.note) o.note = String(d.note).slice(0, 300);
    if (d && d.dateUnsure) o.dateUnsure = true;
    return o;
  }).filter(function(d) { return d.date || d.cells.some(function(c) { return c.raw; }); });
  return { month: m.month, src: src, at: Date.now(), by: aregWho(), title: String(m.title || '').slice(0, 60), columns: columns, days: days,
    notes: (m.notes || []).map(function(n) { return String(n).slice(0, 500); }).slice(0, 30) };
}
function aregImportData(data) {
  if (!data || data.kind !== 'sep-att-register' || !Array.isArray(data.months)) return { error: 'Not a register file' };
  var out = { added: 0, kept: 0, bad: 0, months: [] };
  data.months.forEach(function(m) {
    var mo = aregCleanMonth(m, 'import');
    if (!mo) { out.bad++; return; }
    if (aregMonthOf(mo.month)) { out.kept++; return; }
    aregData().months[mo.month] = mo;
    out.added++;
    out.months.push(mo.month);
  });
  return out;
}
function aregImport() {
  if (!grdGate('imports', 'import a register', aregImport)) return;   // P1 (guard.js)
  var inp = document.getElementById('aregFile');
  if (!inp) return;
  inp.value = '';
  inp.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function(e2) { aregImportText(e2.target.result, f.name); };
    r.readAsText(f);
  };
  inp.click();
}
/* A sep-att-register file's text, from the Register's Import or from Add → File (add.js). */
function aregImportText(text, name) {
  var res;
  try { res = aregImportData(JSON.parse(text)); } catch (e) { res = { error: 'Not a register file' }; }
  if (res.error) { if (!addFileElsewhere(text, name, 'register')) showToast(res.error, 'error'); return; }
  if (res.months.length) _aregMonth = res.months.sort()[res.months.length - 1];
  saveState();
  _attView = 'register';
  renderAttendance();
  var bits = [];
  if (res.added) bits.push(res.added + ' month' + (res.added === 1 ? '' : 's') + ' added');
  if (res.kept) bits.push(res.kept + ' already on record, kept');
  if (res.bad) bits.push(res.bad + ' not read');
  showToast(bits.length ? bits.join(' · ') : 'Nothing in that file');
}

/* ===== A PHOTO OF THE PAGE, READ BY GEMINI =====
   A transcription in the import's shape (the reading is this app's, in code). Nothing counts until it is on the screen, each
   unsure cell dashed; only facts about the photo are kept, never the image. A month already on record is not read over. */
var AREG_PROMPT = 'This is a photo of one page of a handwritten monthly attendance register from a factory. Transcribe it cell by cell, exactly as written; do not interpret, total or correct. ' +
  'The page has a title (month and year), a header row of worker names left to right, a date column, and one cell per worker per day. A Sunday or holiday is a line with the letters S U N D A Y or H O L I D A Y spread across the columns, or the word written across. ' +
  'Cells hold things like P, A, H, P-8pm, 6Am-5pm, 6Am-8pm, 6Am-12Am, P-6Am, 8:30Am-2pm, or a dash. Under the last row some columns carry a total like OT-89 or 103 Hrs. ' +
  'Write times as 6am-5pm, p-8pm; keep P, A, H uppercase. Set unsure on any cell you cannot read with confidence, giving your best reading. One entry in days per written row, in page order; give each row its calendar date as YYYY-MM-DD and kind work, sunday or holiday.';
var AREG_SCHEMA = { type: 'object', properties: {
  month: { type: 'string', description: 'YYYY-MM' }, title: { type: 'string' },
  columns: { type: 'array', items: { type: 'string' } },
  days: { type: 'array', items: { type: 'object', properties: {
    date: { type: 'string', nullable: true }, written: { type: 'string' }, kind: { type: 'string', enum: ['work', 'sunday', 'holiday'] },
    cells: { type: 'array', items: { type: 'object', properties: { raw: { type: 'string' }, unsure: { type: 'boolean' } }, required: ['raw'] } },
    note: { type: 'string', nullable: true } }, required: ['written', 'kind', 'cells'] } },
  totals: { type: 'array', items: { type: 'object', properties: { col: { type: 'integer' }, raw: { type: 'string' } }, required: ['col', 'raw'] } },
  notes: { type: 'array', items: { type: 'string' } } }, required: ['month', 'columns', 'days'] };
function aregPhoto() {
  if (!attFloorOk()) return;
  var inp = document.getElementById('aregPhotoFile');
  if (!inp) return;
  inp.value = '';
  inp.onchange = function(ev) { var f = ev.target.files[0]; if (f) aregPhotoRead(f); };
  inp.click();
}
function aregPhotoRead(file) {
  showToast('Reading the page…');
  return geminiReadImage(file, AREG_PROMPT, { schema: AREG_SCHEMA, maxEdge: 2400, thinkingBudget: 0 }).then(function(res) {
    if (!res.ok) { uiAlert({ title: 'The page was not read', body: res.error || 'Gemini did not answer.' }); return false; }
    var j = res.json || {};
    j.columns = (j.columns || []).map(function(n) { return { name: n }; });
    var mo = aregCleanMonth(j, 'photo');
    if (!mo) { uiAlert({ title: 'Not a register page', body: 'The photo did not read as a month&rsquo;s page with a column per worker.' }); return false; }
    if (aregMonthOf(mo.month)) { uiAlert({ title: aregMonthLabel(mo.month) + ' is already on record', body: 'A page already on record is not read over. Correct its cells by tapping them.' }); return false; }
    mo.photo = { size: file.size || 0, model: typeof geminiModel === 'function' ? geminiModel() : '', at: Date.now() };
    aregData().months[mo.month] = mo;
    _aregMonth = mo.month;
    saveState();
    renderAttendance();
    showToast(aregMonthLabel(mo.month) + ' read: check the dashed cells');
    return true;
  });
}

/* ===== ACTIONS ===== */
function aregStepMonth(n) {
  var d = attParseIso(aregMonthShown() + '-01');
  d.setMonth(d.getMonth() + n);
  _aregMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  viewTop();
  renderAttendance();
}
function aregAction(action, btn) {
  switch (action) {
    case 'invAregStep': aregStepMonth(parseInt(btn.dataset.step, 10)); return true;
    case 'invAregNow': _aregMonth = localDateStr().slice(0, 7); renderAttendance(); return true;
    case 'invAregStart': aregStart(); return true;
    case 'invAregFill': aregFill(); return true;
    case 'invAregVerify': aregVerify(); return true;
    case 'invAregImport': aregImport(); return true;
    case 'invAregPhoto': aregPhoto(); return true;
    case 'invAregCol': dialogOpen(aregColHtml(parseInt(btn.dataset.c, 10)), { dismiss: true }); return true;
    case 'invAregCell': aregCellOpen(parseInt(btn.dataset.d, 10), parseInt(btn.dataset.c, 10)); return true;
    case 'invAregCellClose': _aregCellAt = null; closeOverlay(); return true;
    case 'invAregQuick': if (aregSetRaw(btn.dataset.v)) aregCellRedraw(); return true;
    case 'invAregSure': {
      var mo = aregMonthOf(aregMonthShown()), at = _aregCellAt;
      if (mo && at && attFloorOk()) { delete mo.days[at.d].cells[at.c].unsure; saveState(); aregCellRedraw(); }
      return true;
    }
    case 'invAregToDay': {
      var mo2 = aregMonthOf(aregMonthShown()), at2 = _aregCellAt;
      if (mo2 && at2 && attFloorOk() && aregPutOnDay(mo2, at2.d, at2.c, aregColWorker(mo2, at2.c))) { saveState(); aregCellRedraw(); showToast('The day takes the register’s'); }
      return true;
    }
    case 'invAregFromDay': {
      var mo3 = aregMonthOf(aregMonthShown()), at3 = _aregCellAt, w3 = mo3 && at3 ? aregColWorker(mo3, at3.c) : null;
      var m3 = w3 ? attMark(mo3.days[at3.d].date, w3.id) : null;
      if (m3 && aregSetRaw(aregRawOf(m3))) { aregCellRedraw(); showToast('The register takes the day’s'); }
      return true;
    }
    case 'invAregNext': {
      var mo4 = aregMonthOf(aregMonthShown()), nx = mo4 && _aregCellAt ? aregNextCell(mo4, _aregCellAt) : null;
      if (nx) { _aregCellAt = nx; aregCellRedraw(); var f = document.querySelector('[data-areg-raw]'); if (f && !touchScreen()) f.focus(); }
      return true;
    }
  }
  return false;
}
/* The cell's text field and a column's pick speak through change. */
function aregOnChange(el) {
  if (!el || !el.hasAttribute) return false;
  if (el.hasAttribute('data-areg-raw')) { if (aregSetRaw(el.value)) aregCellRedraw(); return true; }
  if (el.hasAttribute('data-areg-pick')) { aregPickCol(parseInt(el.getAttribute('data-areg-pick'), 10), el.value); closeOverlay(); return true; }
  return false;
}
