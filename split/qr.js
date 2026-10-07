/* ===== QR CODES, made here: no library, no network =====
   The ID cards (idcard.js) and the office check-in sheet carry a QR code (owner, 7 Oct 2026). A library would be a second
   copy of code to keep, and a service would send a worker's card number off the device, so the app draws its own: byte
   mode, error correction M (15% of the code may be lost: a card in a pocket), versions 1 to 10 (up to 213 bytes, the office
   check-in link included). `qrMatrix(text)` gives the modules, `qrSvg(text)` an SVG whose squares are attributes, never a
   style. Checked by decoding what it draws (P169). */

// Per version (1–10), error correction M: [ec codewords a block, [blocks, data codewords]...].
var QR_EC_M = [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]],
  [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
var QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* Arithmetic in GF(256), polynomial 0x11d. */
var QR_EXP = [], QR_LOG = [];
(function() { var x = 1; for (var i = 0; i < 255; i++) { QR_EXP[i] = x; QR_LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (var j = 255; j < 512; j++) QR_EXP[j] = QR_EXP[j - 255]; })();
function qrMul(a, b) { return a && b ? QR_EXP[QR_LOG[a] + QR_LOG[b]] : 0; }
/* The Reed–Solomon remainder of `data` for `n` error correction codewords. */
function qrRs(data, n) {
  var gen = [1];
  for (var i = 0; i < n; i++) {
    var next = [];
    for (var j = 0; j <= gen.length; j++) next[j] = (j < gen.length ? gen[j] : 0) ^ (j > 0 ? qrMul(gen[j - 1], QR_EXP[i]) : 0);
    gen = next;
  }
  var res = data.slice().concat(new Array(n).fill(0));
  for (var k = 0; k < data.length; k++) {
    var c = res[k];
    if (c) for (var m = 1; m < gen.length; m++) res[k + m] ^= qrMul(gen[m], c);
  }
  return res.slice(data.length);
}
function qrUtf8(text) {
  var s = unescape(encodeURIComponent(String(text))), out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}
function qrDataCw(v) { var t = QR_EC_M[v]; return t.slice(1).reduce(function(s, g) { return s + g[0] * g[1]; }, 0); }
/* The codewords: mode, count, the bytes, terminator, padding; then split into blocks, each with its remainder, interleaved. */
function qrCodewords(bytes, v) {
  var bits = [], put = function(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
  bytes.forEach(function(b) { put(b, 8); });
  var cap = qrDataCw(v) * 8;
  for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  var cw = [];
  for (var i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (var p = 0; cw.length < cap / 8; p++) cw.push(p % 2 ? 0x11 : 0xEC);
  var ec = QR_EC_M[v][0], blocks = [], at = 0;
  QR_EC_M[v].slice(1).forEach(function(g) { for (var b = 0; b < g[0]; b++) { var d = cw.slice(at, at + g[1]); at += g[1]; blocks.push({ d: d, e: qrRs(d, ec) }); } });
  var out = [], max = Math.max.apply(null, blocks.map(function(b) { return b.d.length; }));
  for (var x = 0; x < max; x++) blocks.forEach(function(b) { if (x < b.d.length) out.push(b.d[x]); });
  for (var y = 0; y < ec; y++) blocks.forEach(function(b) { out.push(b.e[y]); });
  return out;
}
function qrBch(val, poly, polyBits) {
  var v = val << (polyBits - 1);
  for (var i = 31; i >= polyBits - 1; i--) if ((v >> i) & 1) v ^= poly << (i - polyBits + 1);
  return v;
}
var QR_MASKS = [
  function(r, c) { return (r + c) % 2 === 0; }, function(r) { return r % 2 === 0; }, function(r, c) { return c % 3 === 0; },
  function(r, c) { return (r + c) % 3 === 0; }, function(r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
  function(r, c) { return (r * c) % 2 + (r * c) % 3 === 0; }, function(r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
  function(r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];

/* The modules of `text`, a square of true (dark) and false, or null when it is past version 10. */
function qrMatrix(text) {
  var bytes = qrUtf8(text), v = 1;
  while (v <= 10 && bytes.length + (v < 10 ? 2 : 3) > qrDataCw(v)) v++;
  if (v > 10) return null;
  var n = 17 + 4 * v, m = [], fn = [];
  for (var r = 0; r < n; r++) { m.push(new Array(n).fill(false)); fn.push(new Array(n).fill(false)); }
  var set = function(r, c, d) { m[r][c] = d; fn[r][c] = true; };
  var finder = function(r0, c0) {
    for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
      var rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      set(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (var i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  var al = QR_ALIGN[v];
  al.forEach(function(ar) { al.forEach(function(ac) {
    if ((ar === 6 && ac === 6) || (ar === 6 && ac === n - 7) || (ar === n - 7 && ac === 6)) return;
    for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) set(ar + r, ac + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }); });
  // Reserve the format areas (written per mask below) and the dark module; the version areas from version 7.
  for (var f = 0; f < 9; f++) { fn[8][f] = true; fn[f][8] = true; }
  for (var g = 0; g < 8; g++) { fn[8][n - 1 - g] = true; fn[n - 1 - g][8] = true; }
  set(n - 8, 8, true);
  if (v >= 7) {
    var vb = (v << 12) | qrBch(v, 0x1F25, 13);
    for (var b = 0; b < 18; b++) { var dk = ((vb >> b) & 1) === 1, a = Math.floor(b / 3), cc2 = n - 11 + b % 3; set(a, cc2, dk); set(cc2, a, dk); }
  }
  // The data, up and down in two-column strips from the bottom right, skipping the timing column.
  var cw = qrCodewords(bytes, v), bits = [];
  cw.forEach(function(x) { for (var k = 7; k >= 0; k--) bits.push((x >> k) & 1); });
  var idx = 0, up = true;
  for (var col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (var s = 0; s < n; s++) {
      var row = up ? n - 1 - s : s;
      for (var d = 0; d < 2; d++) { var c = col - d; if (!fn[row][c]) { m[row][c] = idx < bits.length ? bits[idx] === 1 : false; idx++; } }
    }
    up = !up;
  }
  // The mask that leaves the fewest penalties.
  var best = null, bestScore = Infinity;
  for (var k2 = 0; k2 < 8; k2++) {
    var t = m.map(function(row2) { return row2.slice(); });
    for (var r2 = 0; r2 < n; r2++) for (var c3 = 0; c3 < n; c3++) if (!fn[r2][c3] && QR_MASKS[k2](r2, c3)) t[r2][c3] = !t[r2][c3];
    qrFormat(t, n, k2);
    var sc = qrPenalty(t, n);
    if (sc < bestScore) { bestScore = sc; best = t; }
  }
  return best;
}
/* The format bits (level M, the mask), twice: round the top-left finder, and split between the other two. */
function qrFormat(t, n, mask) {
  var data = (0 << 3) | mask, bits = ((data << 10) | qrBch(data, 0x537, 11)) ^ 0x5412;
  for (var i = 0; i < 15; i++) {
    var dk = ((bits >> i) & 1) === 1;
    if (i < 6) t[i][8] = dk; else if (i === 6) t[7][8] = dk; else if (i === 7) t[8][8] = dk; else if (i === 8) t[8][7] = dk; else t[8][14 - i] = dk;
    if (i < 8) t[8][n - 1 - i] = dk; else t[n - 15 + i][8] = dk;
  }
  t[n - 8][8] = true;
}
function qrPenalty(t, n) {
  var p = 0, r, c, run, dark = 0;
  for (r = 0; r < n; r++) {
    for (var dir = 0; dir < 2; dir++) {
      run = 1;
      for (c = 1; c < n; c++) {
        var a = dir ? t[c][r] : t[r][c], b = dir ? t[c - 1][r] : t[r][c - 1];
        if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
    }
  }
  for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) { var q = t[r][c]; if (q === t[r + 1][c] && q === t[r][c + 1] && q === t[r + 1][c + 1]) p += 3; }
  var pat = [true, false, true, true, true, false, true];
  var at = function(rr, cc, h) { return h ? t[rr][cc] : t[cc][rr]; };
  for (r = 0; r < n; r++) for (c = 0; c + 6 < n; c++) for (var h = 0; h < 2; h++) {
    var ok = true;
    for (var k = 0; k < 7 && ok; k++) ok = at(r, c + k, h) === pat[k];
    if (!ok) continue;
    var light = function(from, to) { for (var x = from; x < to; x++) { if (x < 0 || x >= n) continue; if (at(r, x, h)) return false; } return true; };
    if (light(c - 4, c) || light(c + 7, c + 11)) p += 40;
  }
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (t[r][c]) dark++;
  p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return p;
}
/* An SVG of the code with its quiet zone: one path of dark squares, its size set by the stylesheet. */
function qrSvg(text, label) {
  var mx = qrMatrix(text);
  if (!mx) return '';
  var n = mx.length, q = 4, d = '';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (mx[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
  return '<svg class="inv-qr" viewBox="0 0 ' + (n + 2 * q) + ' ' + (n + 2 * q) + '" shape-rendering="crispEdges" role="img" aria-label="' + escHtml(label || 'QR code') + '">' +
    '<rect class="inv-qr-bg" width="' + (n + 2 * q) + '" height="' + (n + 2 * q) + '"></rect><path class="inv-qr-fg" d="' + d + '"></path></svg>';
}
