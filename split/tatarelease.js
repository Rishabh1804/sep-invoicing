/* ===== TATA MOTORS' MONTHLY RELEASE, READ BY CLAUDE =====
   Owner, 10 Nov 2026: "For Tata Motors I have to enter the figures by hand, let's have it so that those are updated by reading the
   news and related release from the Tata Motors plant. All of those information are released to the public and shareholders."

   - WHERE THE FIGURES COME FROM. Tata Motors' own sales release for the month (tatamotors.com) or its filing with the exchanges
     (bseindia.com, nseindia.com), and nowhere else: the news retells the release, and one retelling of October 2026 printed a
     domestic and an export figure that did not add up to the total. Claude searches and reads those three sites only (the web
     search and web fetch tools, each held to them), then hands back what it read through one tool, `record_release`, whose
     shape the API holds it to.
   - CHECKED IN CODE BEFORE IT IS BELIEVED (trCheck): the month asked, a link on one of the three sites, whole numbers, and the
     release's own arithmetic: CVs in India + CV exports = all CVs, for the month and for the same month a year before, and heavy
     trucks within CVs in India. A reading that passes is saved as the month's figures (src 'release', its link and day), unless
     the month was typed by hand: then it is OFFERED beside what was typed, never written over it. A reading that fails a check is
     offered in the Tata dialog with what failed, never saved.
   - WHEN. Asked when Home is drawn (with the feeds) for the month before, from the 1st until it is saved, at most every 6 hours and
     8 times a month on a device; never offline, hidden or under test (unless window.__sepTataReadOn), never with nobody signed in or
     for an ID that may not change Settings, and only with the Claude key on the device (Settings → Connections → Photo reading).
     The Tata dialog's **Read the release** asks for the month shown, whenever the owner wants.
   - WHAT LEAVES THE DEVICE: the month asked and the prompt below, to Anthropic with the device's key. Nothing of the book.
   - WHAT IS KEPT ON THE DEVICE (localStorage sep_inv_tata_read, by month): the tries, when, how the last ended and an offer, never
     in the book. What a read cost joins the photos' figure (phSpentAdd, kind 'tata').
*/
var TR_STORE_KEY = 'sep_inv_tata_read';
var TR_DOMAINS = ['tatamotors.com', 'bseindia.com', 'nseindia.com'];
var TR_GAP_MS = 6 * 3600000;        // a month asked again on a device after this long
var TR_TRIES = 8;                   // and no more than this many times a month
var TR_SEARCH_USD = 0.01;           // a web search, $10 a thousand
var TR_TURNS = 3;                   // a paused turn resumed at most twice
var _trBusy = '';                   // the month being read

function trLive() { try { return !navigator.webdriver || window.__sepTataReadOn === true; } catch (e) { return true; } }
function trStoreAll() {
  try { var v = JSON.parse(localStorage.getItem(TR_STORE_KEY) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function trStore(month) { var r = trStoreAll()[month]; return r && typeof r === 'object' ? r : {}; }
function trStorePut(month, rec) {
  var all = trStoreAll(), keep = {};
  all[month] = rec;
  // The last twelve months kept: an older reading is history the book already holds.
  Object.keys(all).filter(mktMonthOk).sort().slice(-12).forEach(function(m) { keep[m] = all[m]; });
  try { localStorage.setItem(TR_STORE_KEY, JSON.stringify(keep)); } catch (e) { /* asked again next time */ }
}
/* The month the release is read for: the month before this one, from the 1st, until its figures are saved. */
function trDue() {
  var prev = mktMonthAdd(localDateStr().slice(0, 7), -1);
  return mktTyped(mktRead().tata[prev]) ? null : prev;
}

/* ---------- The request ---------- */
function trSchema() {
  var fig = phObj({ now: phNull('integer'), ly: phNull('integer') });
  return phObj({
    found: { type: 'boolean' },
    month: { type: 'string' },
    source: { type: 'string', enum: ['release', 'filing', 'none'] },
    released: phNull('string'),
    url: phNull('string'),
    cvTotal: fig, cvDomestic: fig, cvExport: fig, hcv: fig,
    quote: { type: 'string' },
    note: { type: 'string' }
  });
}
function trPrompt(month) {
  var ly = mktMonthAdd(month, -12);
  return 'Find Tata Motors\' commercial vehicle sales release for ' + mktMonthLabel(month) + ' and read four figures from it.\n\n' +
    'Use only Tata Motors\' own press release (tatamotors.com) or the same release as filed with BSE (bseindia.com) or NSE (nseindia.com). ' +
    'Tata Motors publishes it on or about the first day of the next month. Do not use news articles or any other site: they retell the release and sometimes get the figures wrong.\n\n' +
    'Read these figures as the release prints them, in units, for ' + mktMonthLabel(month) + ' (now) and for ' + mktMonthLabel(ly) + ' (ly, the same month a year before):\n' +
    '- cvTotal: total commercial vehicle sales, domestic and international together.\n' +
    '- cvDomestic: total domestic commercial vehicle sales (India).\n' +
    '- cvExport: commercial vehicle exports (international business or CV exports).\n' +
    '- hcv: domestic HCV trucks (heavy commercial vehicle trucks sold in India).\n' +
    'Copy each number exactly. Do not add up, round or work out a figure the release does not print: leave it null. ' +
    'Passenger vehicles and electric passenger cars are not part of any of these.\n\n' +
    'Then call the record_release tool once. Set found to false and source to "none" if the release for ' + mktMonthLabel(month) + ' is not published yet or cannot be found on those sites. ' +
    'month is "' + month + '". released is the release date as YYYY-MM-DD. url is the address of the page or filing you read the figures from. ' +
    'quote is the lines of the release that carry the figures, copied word for word (at most 800 characters). note says anything a reader should know, or "".';
}
function trBody(month) {
  var dom = TR_DOMAINS.slice();
  return { model: PH_MODEL, max_tokens: 16000, output_config: { effort: 'medium' },
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 4, allowed_domains: dom },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4, allowed_domains: dom },
      { name: 'record_release', strict: true, input_schema: trSchema(),
        description: 'Record the figures read from Tata Motors\' monthly commercial vehicle sales release, or that it was not found. Call once, at the end.' }
    ],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: trPrompt(month) }] };
}
function trUsd(usage) {
  var s = usage && usage.server_tool_use;
  return phUsd(usage) + (s && s.web_search_requests ? s.web_search_requests * TR_SEARCH_USD : 0);
}
/* One reading: { ok: true, input, meta } or { ok: false, code, error, meta }. */
async function trRead(month) {
  var key = phKey();
  if (!key) return { ok: false, code: 'key', error: 'No Claude key is set on this device (Settings → Connections → Photo reading).' };
  var body = trBody(month), usd = 0, model = PH_MODEL, data = null;
  for (var turn = 0; turn < TR_TURNS; turn++) {
    var r = await phPost(key, body, 'Try again later.');
    if (r.fail) return r.fail;
    var status = r.res.status, err;
    data = r.data;
    err = data && data.error ? (data.error.message || data.error.type || '') : '';
    if (status === 401 || status === 403) return { ok: false, code: 'key', error: 'Anthropic refused the key on this device. Check it in Settings → Connections → Photo reading.' };
    if (status === 402 || /credit balance|billing/i.test(err)) return { ok: false, code: 'billing', error: 'The Claude credit is used up. Add credit at console.anthropic.com.' };
    if (status === 429) return { ok: false, code: 'quota', error: 'Too many requests at once. Try again in a minute.' };
    if (status === 529 || status >= 500) return { ok: false, code: 'busy', error: 'Anthropic is busy just now. Try again in a minute.' };
    if (status !== 200 || !data) return { ok: false, code: 'api', error: err || ('Anthropic answered ' + status + '.') };
    usd += trUsd(data.usage);
    model = data.model || model;
    // The server's search loop paused: the turn is sent back as it is and the server goes on where it stopped.
    if (data.stop_reason === 'pause_turn') { body = Object.assign({}, body, { messages: body.messages.concat([{ role: 'assistant', content: data.content }]) }); continue; }
    break;
  }
  var meta = { model: model, usd: Math.round(usd * 1e6) / 1e6 };
  if (meta.usd) phSpentAdd(meta.usd, 'tata');
  if (data.stop_reason === 'refusal') return { ok: false, code: 'refused', error: 'Claude declined to read the release.', meta: meta };
  if (data.stop_reason === 'pause_turn') return { ok: false, code: 'unfinished', error: 'Claude did not finish reading the release. Try again later.', meta: meta };
  var call = (data.content || []).find(function(b) { return b && b.type === 'tool_use' && b.name === 'record_release'; });
  if (!call || !call.input || typeof call.input !== 'object') return { ok: false, code: 'none', error: 'Claude did not say what the release holds. Try again later.', meta: meta };
  return { ok: true, input: call.input, meta: meta };
}

/* ---------- The checks ---------- */
function trHostOk(url) {
  var h = feedHost(url);
  return !!h && /^https:/i.test(url) && TR_DOMAINS.some(function(d) { return h === d || h.slice(-(d.length + 1)) === '.' + d; });
}
function trInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MKT_FIG_MAX ? v : null; }
/* What a reading says, checked: { state ('ok' | 'notout' | 'failed'), rec (the month's figures as the dialog saves them), fails:
   [words], checked: [words] }. */
function trCheck(month, inp) {
  var fails = [], checked = [];
  if (!inp || inp.found !== true) return { state: 'notout', rec: null, fails: ['The release for ' + mktMonthLabel(month) + ' was not found on Tata Motors’ site or the exchanges.'], checked: [] };
  if (inp.month !== month) fails.push('It read ' + (mktMonthOk(inp.month) ? mktMonthLabel(inp.month) : 'another month') + ', not ' + mktMonthLabel(month) + '.');
  var url = feedSafeUrl(inp.url);
  if (!url || !trHostOk(url)) fails.push('Its link is not Tata Motors’ site or an exchange filing.');
  var rec = { released: '', url: url || '', note: '' }, bad = false;
  MKT_FIGS.forEach(function(f) {
    var x = inp[f.key] && typeof inp[f.key] === 'object' ? inp[f.key] : {}, now = trInt(x.now), ly = trInt(x.ly);
    if ((x.now != null && now == null) || (x.ly != null && ly == null)) bad = true;
    rec[f.key] = { now: now, ly: ly };
  });
  if (bad) fails.push('A figure is not a whole number of units.');
  var t = rec.cvTotal, d = rec.cvDomestic, e = rec.cvExport, h = rec.hcv;
  if (t.now == null || d.now == null || e.now == null) fails.push('All CVs, CVs in India and CV exports are not all there.');
  else if (d.now + e.now !== t.now) fails.push('CVs in India and exports (' + mktFmt(d.now) + ' + ' + mktFmt(e.now) + ') do not add up to all CVs (' + mktFmt(t.now) + ').');
  else checked.push('India and exports add up to all CVs');
  if (t.ly != null && d.ly != null && e.ly != null) {
    if (d.ly + e.ly !== t.ly) fails.push('A year before, India and exports do not add up to all CVs.');
    else checked.push('the year before adds up too');
  }
  if (h.now != null && d.now != null && h.now > d.now) fails.push('Heavy trucks are more than all CVs in India.');
  if (typeof inp.released === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inp.released)) {
    if (inp.released.slice(0, 7) <= month) fails.push('Its date (' + formatDate(inp.released) + ') is before the month ended.');
    else rec.released = inp.released;
  }
  rec.note = ('Read by Claude from ' + (inp.source === 'filing' ? 'the exchange filing' : 'Tata Motors’ release') + (checked.length ? '; ' + checked.join(', ') : '') + '.').slice(0, 300);
  return { state: fails.length ? 'failed' : 'ok', rec: rec, fails: fails, checked: checked, quote: feedText(inp.quote, 800) };
}
/* The same figures, field by field. */
function trSame(a, b) {
  return MKT_FIGS.every(function(f) { var x = mktFigOf(a, f.key), y = mktFigOf(b, f.key); return x.now === y.now && (y.ly == null || x.ly === y.ly); });
}

/* ---------- Reading a month ---------- */
/* Read the month and act on it. how: 'auto' (from Home) or 'hand' (the dialog's button). Returns what happened, as kept on the device:
   { month, at, tries, code ('saved' | 'agrees' | 'offered' | 'notout' | an error's code), why, offer }. */
async function trRun(month, how) {
  if (!mktMonthOk(month) || _trBusy) return null;
  _trBusy = month;
  trRedraw();
  var was = trStore(month), out = { month: month, at: Date.now(), tries: (was.tries || 0) + 1, code: '', why: '', offer: null };
  try {
    var r = await trRead(month);
    if (!r.ok) { out.code = r.code; out.why = r.error; }
    else {
      var c = trCheck(month, r.input), t = mktData().tata, typed = mktTyped(t[month]);
      if (c.state === 'notout') { out.code = 'notout'; out.why = c.fails[0]; }
      else if (c.state === 'ok' && !typed) {
        t[month] = Object.assign({}, c.rec, { at: Date.now(), by: 'Tata’s release, read by Claude', src: 'release', read: { model: r.meta.model, usd: r.meta.usd } });
        saveState();
        out.code = 'saved'; out.why = mktMonthLabel(month) + '’s figures were read from ' + (feedHost(c.rec.url) || 'the release') + ' and saved.';
      } else if (c.state === 'ok' && trSame(t[month], c.rec)) { out.code = 'agrees'; out.why = 'The release agrees with what is typed.'; }
      else {
        out.code = 'offered';
        out.why = c.state === 'ok' ? 'The release differs from what is typed: it is offered, not written over it.' : c.fails.join(' ');
        out.offer = { rec: c.rec, fails: c.fails, quote: c.quote, ok: c.state === 'ok' };
      }
    }
  } catch (e) {
    out.code = 'error'; out.why = 'The release could not be read (' + ((e && e.message) || 'error') + ').';
  } finally { _trBusy = ''; }
  trStorePut(month, out);
  if (out.code === 'saved') {
    showToast(out.why);
    if (typeof tabRedrawActive === 'function') { try { tabRedrawActive(); } catch (e) { /* the page under redraws on its next visit */ } }
    try { document.dispatchEvent(new CustomEvent('sep-feeds', { detail: { kind: 'tata', ok: true } })); } catch (e) { /* no board to tell */ }
  } else if (how === 'hand') showToast(out.why, out.code === 'agrees' ? 'success' : out.code === 'offered' || out.code === 'notout' ? 'info' : 'error');
  trRedraw();
  return out;
}
/* From Home, with the feeds: the month due, within the rules above. Resolves to the run, or null where nothing was asked. */
function trEnsure() {
  try {
    if (!trLive() || !feedOnline() || feedHidden() || !phKey() || _trBusy || !S) return Promise.resolve(null);
    if (typeof bookStandIn === 'function' && bookStandIn()) return Promise.resolve(null);
    if (typeof grdNobody === 'function' && grdNobody()) return Promise.resolve(null);
    if (!mktCanEdit()) return Promise.resolve(null);
    var m = trDue();
    if (!m) return Promise.resolve(null);
    var was = trStore(m);
    if ((was.tries || 0) >= TR_TRIES || (was.at && Date.now() - was.at < TR_GAP_MS)) return Promise.resolve(null);
    if (was.code === 'offered') return Promise.resolve(null);   // waits for the owner
    return trRun(m, 'auto');
  } catch (e) { return Promise.resolve(null); }
}
/* The dialog's button: the month shown, asked now. */
function trHand(month) {
  if (!phKey()) { showToast('Set the Claude key first: Settings → Connections → Photo reading', 'error'); return; }
  if (!feedOnline()) { showToast('This device is offline', 'error'); return; }
  if (!grdGate('settings', 'read Tata Motors’ release', function() { trHand(month); })) return;
  trRun(month, 'hand');
}
/* The offer's figures put in the dialog's fields for the owner to check; nothing is saved until Save. */
function trUseOffer(month) {
  var o = trStore(month).offer;
  if (!o || !o.rec || !_mktDlg || _mktDlg.month !== month) return;
  MKT_FIGS.forEach(function(f) {
    var x = o.rec[f.key] || {};
    ['now', 'ly'].forEach(function(w) { if (x[w] != null) mktUse(f.key, w, x[w]); });
  });
  var set = function(id, v) { var el = document.getElementById(id); if (el && !el.disabled && v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
  set('mktRel', o.rec.released); set('mktUrl', o.rec.url);
  mktSyncTyped();
}

/* ---------- In the Tata dialog ---------- */
function trRedraw() { if (typeof mktPartRedraw === 'function' && _mktDlg) { try { mktPartRedraw('release'); } catch (e) { /* drawn on next open */ } } }
/* The release's part of the dialog: the button, how the last reading of the month ended, and an offer. */
function trPartHtml() {
  if (!_mktDlg) return '';
  var m = _mktDlg.month, can = mktCanEdit(), rec = mktRead().tata[m] || {}, st = trStore(m), key = !!phKey();
  var busy = _trBusy === m;
  var head = '<div class="inv-panel-head"><span class="inv-panel-title">Tata Motors’ release</span>' +
    (can ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktRead" data-month="' + escHtml(m) + '"' + (busy || !key ? ' disabled' : '') + '>' +
      (busy ? 'Reading…' : 'Read the release') + '</button>' : '') + '</div>';
  var rows = [];
  if (rec.src === 'release') {
    rows.push('<div class="inv-row inv-row-2" data-tr-saved><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">Read from the release' + (rec.at ? ' ' + escHtml(formatTimestamp(rec.at)) : '') + '</span>' +
      '<span class="inv-row-meta">' + (rec.url ? '<a class="inv-btn-link" href="' + escHtml(feedSafeUrl(rec.url)) + '" target="_blank" rel="noopener noreferrer">' + escHtml(feedHost(rec.url) || 'the release') + '</a>' : 'no link') +
      (rec.released ? ' · ' + escHtml(formatDate(rec.released)) : '') + '</span></span>' + uiRowEndHtml('', { tone: 'ok', word: 'checked' }) + '</div>');
  }
  if (busy) rows.push('<div class="inv-row"><span class="inv-note">Claude is reading Tata Motors’ site and the exchange filings for ' + escHtml(mktMonthLabel(m)) + '.</span></div>');
  else if (st.code && !(st.code === 'saved' && rec.src === 'release')) {
    var tone = st.code === 'agrees' || st.code === 'saved' ? 'ok' : st.code === 'offered' ? 'warning' : st.code === 'notout' ? 'neutral' : 'danger';
    rows.push('<div class="inv-row inv-row-2" data-tr-last="' + escHtml(st.code) + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(st.why || '') + '</span>' +
      '<span class="inv-row-meta">' + escHtml('Asked ' + formatTimestamp(st.at) + ' · ' + todoPlural(st.tries || 1, 'try', 'tries') + ' this month') + '</span></span></div>');
  }
  var o = !busy && st.code === 'offered' && st.offer && st.offer.rec ? st.offer : null;
  if (o) {
    var figs = MKT_FIGS.map(function(f) { var x = o.rec[f.key] || {}; return x.now == null ? '' : f.label + ' ' + mktFmt(x.now) + (x.ly != null ? ' (' + mktFmt(x.ly) + ')' : ''); }).filter(Boolean).join(' · ');
    rows.push('<div class="inv-row inv-row-2 inv-row-flow" data-tr-offer><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(figs || 'No figure read') + '</span>' +
      '<span class="inv-row-meta">' + (o.rec.url ? '<a class="inv-btn-link" href="' + escHtml(o.rec.url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(feedHost(o.rec.url)) + '</a>' : 'no link') +
      (o.quote ? ' · “' + escHtml(o.quote.slice(0, 160)) + (o.quote.length > 160 ? '…' : '') + '”' : '') + '</span></span><span class="inv-row-end">' +
      (can ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktUseRelease" data-month="' + escHtml(m) + '">Use</button>' : '') + '</span></div>');
  }
  if (!rows.length) rows.push('<div class="inv-row"><span class="inv-note">' + escHtml(key ? 'Read from Tata Motors’ own release or its exchange filing, and saved only when the figures add up. It is asked by itself from the 1st.' :
    'Set the Claude key (Settings → Connections → Photo reading) and the month’s figures are read from Tata Motors’ release.') + '</span></div>');
  return '<div class="inv-panel inv-panel-flush inv-mb-8" data-tr-part>' + head + rows.join('') + '</div>';
}
