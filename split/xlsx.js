/* ===== XLSX WRITER (the reader follows it) =====
 * A clean Excel workbook without a library (owner, 26 Sep 2026: "BANK Statement export should be a
 * clean sorted excel file"). An .xlsx is a zip of XML parts; this writes the fewest parts Excel,
 * LibreOffice and Google Sheets all open without a repair prompt, zipped STORED (no compression,
 * so no deflate to carry — a bank year is a few hundred kilobytes either way).
 *
 * xlsxBuild([{ name, cols: [width…], rows: [[cell…]…], freeze: rowsToFreeze, filter: true }])
 *   → Uint8Array. A cell is a string, a number, null, or { v, s } where s is a style:
 *   'head' (bold, ruled), 'date' (v an ISO yyyy-mm-dd, written as a real Excel date),
 *   'money' (#,##0.00), 'int', 'bold', 'boldMoney'.
 * Numbers stay numbers and dates stay dates, so the sheet sorts, filters and sums as a sheet should.
 */

var XLSX_STYLE = { head: 1, date: 2, money: 3, int: 4, bold: 5, boldMoney: 6 };

function _xlsxEsc(s) {
  // XML 1.0 has no place for most control characters; a narration that carries one would make the
  // part unreadable, so they are dropped.
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _xlsxCol(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
/* Excel's day count: days since 30 Dec 1899, computed in UTC so no time zone moves a date. */
function _xlsxSerial(iso) {
  var p = String(iso).split('-');
  return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000);
}

function _xlsxSheet(sh, idx) {
  var nCols = Math.max.apply(null, [1].concat(sh.rows.map(function(r) { return r.length; })));
  var h = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<dimension ref="A1:' + _xlsxCol(nCols - 1) + Math.max(1, sh.rows.length) + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"' + (idx === 0 ? ' tabSelected="1"' : '') + '>' +
    (sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="A' + (sh.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') +
    '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
  if (sh.cols && sh.cols.length) {
    h += '<cols>' + sh.cols.map(function(w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
  }
  h += '<sheetData>';
  sh.rows.forEach(function(row, r) {
    h += '<row r="' + (r + 1) + '">';
    row.forEach(function(cell, c) {
      if (cell == null || cell === '') return;
      var v = cell, s = 0;
      if (typeof cell === 'object') { v = cell.v; s = XLSX_STYLE[cell.s] || 0; if (v == null || v === '') { if (s) h += '<c r="' + _xlsxCol(c) + (r + 1) + '" s="' + s + '"/>'; return; } }
      var ref = _xlsxCol(c) + (r + 1), sa = s ? ' s="' + s + '"' : '';
      if (s === XLSX_STYLE.date) h += '<c r="' + ref + '"' + sa + '><v>' + _xlsxSerial(v) + '</v></c>';
      else if (typeof v === 'number' && isFinite(v)) h += '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
      else h += '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + _xlsxEsc(v) + '</t></is></c>';
    });
    h += '</row>';
  });
  h += '</sheetData>';
  if (sh.filter && sh.rows.length > 1) h += '<autoFilter ref="A1:' + _xlsxCol(nCols - 1) + sh.rows.length + '"/>';
  h += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>';
  return { xml: h, nCols: nCols };
}

var _XLSX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00;\\-#,##0.00"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7ECEB"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function xlsxBuild(sheets) {
  var parts = [], built = sheets.map(_xlsxSheet);
  var nameOf = function(sh, i) { return (sh.name || 'Sheet' + (i + 1)).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31); };
  parts.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map(function(s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
    '</Types>']);
  parts.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  var defined = '';
  sheets.forEach(function(sh, i) {
    if (sh.filter && sh.rows.length > 1) defined += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + _xlsxEsc(nameOf(sh, i)) + '\'!$A$1:$' + _xlsxCol(built[i].nCols - 1) + '$' + sh.rows.length + '</definedName>';
  });
  parts.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
    sheets.map(function(s, i) { return '<sheet name="' + _xlsxEsc(nameOf(s, i)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
    '</sheets>' + (defined ? '<definedNames>' + defined + '</definedNames>' : '') + '</workbook>']);
  parts.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map(function(s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
  parts.push(['xl/styles.xml', _XLSX_STYLES]);
  built.forEach(function(b, i) { parts.push(['xl/worksheets/sheet' + (i + 1) + '.xml', b.xml]); });
  return _xlsxZip(parts);
}

/* ---------- A stored (uncompressed) zip ---------- */
var _xlsxCrcTable = null;
function _xlsxCrc(bytes) {
  if (!_xlsxCrcTable) {
    _xlsxCrcTable = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; _xlsxCrcTable[n] = c >>> 0; }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = _xlsxCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function _xlsxZip(files) {
  var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
  // A fixed DOS time (1 Jan 2020): the file's bytes then depend on its content alone.
  var dosTime = 0, dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;
  files.forEach(function(f) {
    var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = _xlsxCrc(data);
    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034B50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);
    var ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014B50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  var cdSize = central.reduce(function(s, c) { return s + c.length; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054B50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  var all = chunks.concat(central, [new Uint8Array(end.buffer)]);
  var out = new Uint8Array(all.reduce(function(s, c) { return s + c.length; }, 0)), p = 0;
  all.forEach(function(c) { out.set(c, p); p += c.length; });
  return out;
}

/* ===== XLSX READER =====
 * A statement saved as .xlsx, read without a library (owner, 8 Oct 2026: the statement saved from Excel as .xlsx was
 * refused as "not an Excel file"). An .xlsx is a zip of XML parts, deflated as Excel writes it: the zip's own directory
 * says where each part starts, the browser's DecompressionStream inflates it, DOMParser reads it. Only what an import
 * needs: the first sheet's cell values, a string from the shared table or written in the cell, a number as a number, a
 * formula by the result Excel kept.
 *
 * xlsxRead(ArrayBuffer) → Promise<{ sheet: name, rows: [[value, ...], ...] }>, the shape xlsRead returns (missing cells
 * undefined). It rejects with a plain message on anything it cannot read.
 */
function _xlsxZipDir(buf) {
  var dv = new DataView(buf), n = buf.byteLength, eocd = -1;
  for (var i = n - 22; i >= 0 && i >= n - 22 - 65535; i--) if (dv.getUint32(i, true) === 0x06054B50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not an Excel workbook: the zip it should be is incomplete');
  var count = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), dir = {}, dec = new TextDecoder('utf-8');
  for (var k = 0; k < count; k++) {
    if (off + 46 > n || dv.getUint32(off, true) !== 0x02014B50) throw new Error('Not an Excel workbook: its list of parts cannot be read');
    var nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
    dir[dec.decode(new Uint8Array(buf, off + 46, nl))] = { method: dv.getUint16(off + 10, true), size: dv.getUint32(off + 20, true), at: dv.getUint32(off + 42, true) };
    off += 46 + nl + xl + cl;
  }
  return dir;
}
/* Whether a zip is an Excel workbook, from its list of parts alone (Add → File asks before it reads). */
function xlsxIsWorkbook(buf) { try { return !!_xlsxZipDir(buf)['xl/workbook.xml']; } catch (e) { return false; } }
async function _xlsxPart(buf, dir, name) {
  var e = dir[name];
  if (!e) return null;
  var dv = new DataView(buf);
  if (e.at + 30 > buf.byteLength || dv.getUint32(e.at, true) !== 0x04034B50) throw new Error('The workbook is damaged (' + name + ' cannot be found)');
  var start = e.at + 30 + dv.getUint16(e.at + 26, true) + dv.getUint16(e.at + 28, true);
  if (start + e.size > buf.byteLength) throw new Error('The workbook is damaged (' + name + ' runs past the end)');
  var raw = new Uint8Array(buf, start, e.size), bytes = raw;
  if (e.method === 8) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open an .xlsx: import the statement as the .xls the bank exports');
    bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  } else if (e.method !== 0) throw new Error('The workbook is packed in a way the app does not read (method ' + e.method + ')');
  return new TextDecoder('utf-8').decode(bytes);
}
function _xlsxXml(text, name) {
  var doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The workbook is damaged (' + name + ' is not readable)');
  return doc;
}
/* Elements by their own name, whatever prefix the writer gave the namespace. */
function _xlsxEls(node, tag) { return Array.prototype.slice.call(node.getElementsByTagNameNS('*', tag)); }
/* A string item's text: its <t>, or its runs' <t> joined; a phonetic reading (<rPh>) is not the text. */
function _xlsxSiText(si) {
  var out = '';
  Array.prototype.forEach.call(si.childNodes, function(ch) {
    if (ch.localName === 't') out += ch.textContent;
    else if (ch.localName === 'r') _xlsxEls(ch, 't').forEach(function(t) { out += t.textContent; });
  });
  return out;
}
/* "AB12" → 27 (the column, from 0). */
function _xlsxColIdx(ref) {
  var m = /^([A-Z]+)/i.exec(ref || ''), n = 0;
  if (!m) return -1;
  for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].toUpperCase().charCodeAt(i) - 64);
  return n - 1;
}
async function xlsxRead(buf) {
  var dir = _xlsxZipDir(buf);
  var wbText = await _xlsxPart(buf, dir, 'xl/workbook.xml');
  if (wbText == null) throw new Error('Not an Excel workbook: the zip holds no xl/workbook.xml');
  var wb = _xlsxXml(wbText, 'the workbook'), first = _xlsxEls(wb, 'sheet')[0];
  if (!first) throw new Error('The workbook has no sheet');
  // The first sheet's part, through the workbook's relationships; a workbook that names none is read at its first sheet part.
  var rid = first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || first.getAttribute('r:id'), path = '';
  var relsText = await _xlsxPart(buf, dir, 'xl/_rels/workbook.xml.rels');
  if (relsText != null && rid) {
    var rel = _xlsxEls(_xlsxXml(relsText, 'the workbook’s links'), 'Relationship').find(function(r) { return r.getAttribute('Id') === rid; });
    var target = rel ? String(rel.getAttribute('Target') || '') : '';
    if (target) path = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  if (!dir[path]) path = Object.keys(dir).filter(function(k) { return /^xl\/worksheets\/[^/]+\.xml$/.test(k); }).sort()[0] || '';
  if (!path) throw new Error('The workbook has no sheet');
  var sst = [], sstText = await _xlsxPart(buf, dir, 'xl/sharedStrings.xml');
  if (sstText != null) sst = _xlsxEls(_xlsxXml(sstText, 'the shared strings'), 'si').map(_xlsxSiText);
  var sheet = _xlsxXml(await _xlsxPart(buf, dir, path), 'the sheet'), rows = [], next = 0;
  _xlsxEls(sheet, 'row').forEach(function(rowEl) {
    var r = parseInt(rowEl.getAttribute('r'), 10);
    r = isFinite(r) && r > 0 ? r - 1 : next;
    next = r + 1;
    var row = rows[r] || (rows[r] = []), col = 0;
    _xlsxEls(rowEl, 'c').forEach(function(c) {
      var ci = _xlsxColIdx(c.getAttribute('r'));
      if (ci < 0) ci = col;
      col = ci + 1;
      var t = c.getAttribute('t') || 'n', vEl = _xlsxEls(c, 'v')[0], v = vEl ? vEl.textContent : null, val;
      if (t === 's') val = v == null ? undefined : sst[parseInt(v, 10)];
      else if (t === 'inlineStr') { var is = _xlsxEls(c, 'is')[0]; val = is ? _xlsxSiText(is) : undefined; }
      else if (t === 'str' || t === 'e' || t === 'd') val = v == null ? undefined : v;
      else if (t === 'b') val = v == null ? undefined : v === '1' ? 1 : 0;
      else if (v != null && v !== '') { var num = Number(v); val = isFinite(num) ? num : v; }
      if (val !== undefined && val !== '') row[ci] = val;
    });
  });
  for (var i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { sheet: first.getAttribute('name') || '', rows: rows };
}
