/* ===== XLS READER (Excel 97–2003, BIFF8 in an OLE compound file) =====
 * Bank of Baroda's statement export (OpTransactionHistoryUX5.xls) is the old binary format, not
 * HTML under an .xls name. The app carries no libraries, so this reads the one thing it needs:
 * the cell values of the first sheet. No formatting, no formulas beyond their cached result.
 *
 * Two layers. The compound file is a small FAT filesystem: 512-byte header, a sector allocation
 * table (whose own sectors are listed in the header and, past 109 of them, in a DIFAT chain), a
 * directory, and a mini stream for anything under 4 KB. Inside it, the "Workbook" stream is a run
 * of BIFF records: [type u16][length u16][data]. Strings live once in the shared string table
 * (SST) and cells point into it; the SST spans CONTINUE records, and a string broken across one
 * restarts with a fresh flags byte saying whether the rest is one or two bytes per character.
 *
 * xlsRead(ArrayBuffer) → { sheet: name, rows: [[value, ...], ...] }, values string or number,
 * missing cells undefined. Throws an Error with a plain message on anything it cannot read.
 */

function _xlsCfbStream(buf, want) {
  var dv = new DataView(buf), u8 = new Uint8Array(buf);
  var SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  for (var i = 0; i < 8; i++) if (u8[i] !== SIG[i]) throw new Error('Not an Excel 97–2003 file (.xls)');
  var ss = 1 << dv.getUint16(0x1E, true), mss = 1 << dv.getUint16(0x20, true);
  var cutoff = dv.getUint32(0x38, true);
  var nSectors = Math.floor((buf.byteLength - 512) / ss);
  var sect = function(id) { return 512 + id * ss; };
  // The FAT's own sectors: 109 in the header, the rest down the DIFAT chain.
  var fatIds = [];
  for (i = 0; i < 109; i++) { var v = dv.getUint32(0x4C + i * 4, true); if (v < 0xFFFFFFFA) fatIds.push(v); }
  var dif = dv.getUint32(0x44, true), guard = 0;
  while (dif < 0xFFFFFFFA && dif < nSectors && guard++ < nSectors) {
    var per = ss / 4 - 1;
    for (i = 0; i < per; i++) { v = dv.getUint32(sect(dif) + i * 4, true); if (v < 0xFFFFFFFA) fatIds.push(v); }
    dif = dv.getUint32(sect(dif) + per * 4, true);
  }
  var fat = [];
  fatIds.forEach(function(id) { for (var k = 0; k < ss / 4; k++) fat.push(dv.getUint32(sect(id) + k * 4, true)); });
  var chain = function(start, table) {
    var out = [], seen = {};
    for (var s = start; s < 0xFFFFFFFA; s = table[s]) {
      if (seen[s] || s >= table.length) throw new Error('The file is damaged (a broken sector chain)');
      seen[s] = true; out.push(s);
    }
    return out;
  };
  var readChain = function(start, size) {
    var ids = chain(start, fat), out = new Uint8Array(ids.length * ss);
    ids.forEach(function(id, k) { out.set(u8.subarray(sect(id), sect(id) + ss), k * ss); });
    return out.subarray(0, size == null ? out.length : size);
  };
  var dir = readChain(dv.getUint32(0x30, true));
  var ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  var entries = [];
  for (var off = 0; off + 128 <= dir.length; off += 128) {
    var nlen = ddv.getUint16(off + 0x40, true), name = '';
    for (var c = 0; c + 2 < nlen; c += 2) name += String.fromCharCode(ddv.getUint16(off + c, true));
    entries.push({ name: name, type: dir[off + 0x42], start: ddv.getUint32(off + 0x74, true), size: ddv.getUint32(off + 0x78, true) });
  }
  var root = entries.find(function(e) { return e.type === 5; });
  var ent = null;
  for (i = 0; i < want.length && !ent; i++) ent = entries.find(function(e) { return e.type === 2 && e.name === want[i]; }) || null;
  if (!ent) throw new Error('No workbook inside the file');
  if (ent.size >= cutoff) return readChain(ent.start, ent.size);
  // A small stream lives in the mini stream, cut into 64-byte sectors with its own table.
  var mini = readChain(root.start), mfat = [];
  if (dv.getUint32(0x3C, true) < 0xFFFFFFFA) {
    var mf = readChain(dv.getUint32(0x3C, true)), mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
    for (i = 0; i + 4 <= mf.length; i += 4) mfat.push(mdv.getUint32(i, true));
  }
  var ids = chain(ent.start, mfat), out = new Uint8Array(ids.length * mss);
  ids.forEach(function(id, k) { out.set(mini.subarray(id * mss, id * mss + mss), k * mss); });
  return out.subarray(0, ent.size);
}

/* A reader over a record and its CONTINUEs, for the SST. A string's characters may break across
   a CONTINUE, and the next piece opens with a flags byte of its own. */
function _xlsChunks(chunks) {
  var ci = 0, pos = 0;
  var need = function() { while (ci < chunks.length && pos >= chunks[ci].length) { ci++; pos = 0; } if (ci >= chunks.length) throw new Error('The file is damaged (the string table ends early)'); };
  var u8 = function() { need(); return chunks[ci][pos++]; };
  return {
    u8: u8,
    u16: function() { var a = u8(); return a | (u8() << 8); },
    u32: function() { var a = this.u16(); return (a + this.u16() * 65536) >>> 0; },
    skip: function(n) { while (n > 0) { need(); var k = Math.min(n, chunks[ci].length - pos); pos += k; n -= k; } },
    chars: function(n, high) {
      var s = '';
      while (n > 0) {
        if (ci < chunks.length && pos >= chunks[ci].length) { ci++; pos = 0; if (ci >= chunks.length) break; high = chunks[ci][pos++] & 1; }
        need();
        if (high) { var lo = chunks[ci][pos++], hi = chunks[ci][pos++]; s += String.fromCharCode(lo | (hi << 8)); }
        else s += String.fromCharCode(chunks[ci][pos++]);
        n--;
      }
      return s;
    }
  };
}

function _xlsRk(rk) {
  var v;
  if (rk & 2) v = rk >> 2;
  else {
    var b = new DataView(new ArrayBuffer(8));
    b.setUint32(0, 0, true); b.setUint32(4, rk & 0xFFFFFFFC, true);
    v = b.getFloat64(0, true);
  }
  return rk & 1 ? v / 100 : v;
}

function xlsRead(buf) {
  var wb = _xlsCfbStream(buf, ['Workbook', 'Book']);
  var dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  var recs = [];
  for (var p = 0; p + 4 <= wb.length;) {
    var type = dv.getUint16(p, true), len = dv.getUint16(p + 2, true);
    recs.push({ type: type, off: p + 4, len: len, data: wb.subarray(p + 4, p + 4 + len) });
    p += 4 + len;
  }
  var sst = [], sheets = [], i;
  for (i = 0; i < recs.length; i++) {
    var r = recs[i];
    if (r.type === 0x2F) throw new Error('The file is password-protected; export it again without a password');
    if (r.type === 0x85) {   // BOUNDSHEET: where each sheet's records begin, and its name
      var bd = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength), nl = r.data[6], hi = r.data[7] & 1, nm = '';
      for (var k = 0; k < nl; k++) nm += String.fromCharCode(hi ? bd.getUint16(8 + k * 2, true) : r.data[8 + k]);
      sheets.push({ pos: bd.getUint32(0, true), name: nm, kind: r.data[5] });   // pos: the sheet's BOF record
    }
    if (r.type === 0xFC) {   // SST, with every CONTINUE after it
      var chunks = [r.data];
      for (var j = i + 1; j < recs.length && recs[j].type === 0x3C; j++) chunks.push(recs[j].data);
      var rd = _xlsChunks(chunks);
      rd.u32();
      var n = rd.u32();
      for (k = 0; k < n; k++) {
        var cch = rd.u16(), fl = rd.u8(), runs = 0, ext = 0;
        if (fl & 8) runs = rd.u16();
        if (fl & 4) ext = rd.u32();
        sst.push(rd.chars(cch, fl & 1));
        if (runs) rd.skip(runs * 4);
        if (ext) rd.skip(ext);
      }
    }
    if (r.type === 0x0A) break;   // end of the workbook globals
  }
  var sheet = sheets.find(function(s) { return s.kind === 0; }) || sheets[0];
  if (!sheet) throw new Error('The workbook has no sheet');
  var start = recs.findIndex(function(x) { return x.off - 4 === sheet.pos; });
  if (start < 0) throw new Error('The file is damaged (the sheet cannot be found)');
  var rows = [], put = function(row, col, v) { (rows[row] = rows[row] || [])[col] = v; }, pendingStr = null;
  for (i = start + 1; i < recs.length; i++) {
    r = recs[i];
    var d = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
    if (r.type === 0x0A) break;
    if (r.type === 0xFD) put(d.getUint16(0, true), d.getUint16(2, true), sst[d.getUint32(6, true)]);
    else if (r.type === 0x203) put(d.getUint16(0, true), d.getUint16(2, true), d.getFloat64(6, true));
    else if (r.type === 0x27E) put(d.getUint16(0, true), d.getUint16(2, true), _xlsRk(d.getUint32(6, true)));
    else if (r.type === 0xBD) {
      var row = d.getUint16(0, true), col = d.getUint16(2, true);
      for (var q = 4; q + 6 <= r.len - 2; q += 6) put(row, col++, _xlsRk(d.getUint32(q + 2, true)));
    } else if (r.type === 0x204) {   // LABEL: an inline string
      var lc = d.getUint16(6, true), lh = r.data[8] & 1, ls = '';
      for (k = 0; k < lc; k++) ls += String.fromCharCode(lh ? d.getUint16(9 + k * 2, true) : r.data[9 + k]);
      put(d.getUint16(0, true), d.getUint16(2, true), ls);
    } else if (r.type === 0x06) {   // FORMULA: its cached result
      if (d.getUint16(12, true) === 0xFFFF) {
        if (r.data[6] === 0) pendingStr = [d.getUint16(0, true), d.getUint16(2, true)];
        else if (r.data[6] === 1) put(d.getUint16(0, true), d.getUint16(2, true), r.data[8] ? 'TRUE' : 'FALSE');
      } else put(d.getUint16(0, true), d.getUint16(2, true), d.getFloat64(6, true));
    } else if (r.type === 0x207 && pendingStr) {
      var sc = d.getUint16(0, true), sh = r.data[2] & 1, ss2 = '';
      for (k = 0; k < sc && 3 + k * (sh ? 2 : 1) < r.len; k++) ss2 += String.fromCharCode(sh ? d.getUint16(3 + k * 2, true) : r.data[3 + k]);
      put(pendingStr[0], pendingStr[1], ss2);
      pendingStr = null;
    }
  }
  for (i = 0; i < rows.length; i++) rows[i] = rows[i] || [];
  return { sheet: sheet.name, rows: rows };
}
