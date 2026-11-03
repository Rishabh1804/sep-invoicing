/* ===== PHOTO READING (Claude) =====
   Owner, 3 Nov 2026: "Let's add photos reader along with it, we have 100$ of claude API credit, so we should be able to use
   that rather than using google?", then: the key on the owner's devices, Opus 5.5, and three kinds of photo (VAT register
   pages, the power log, client challans). It replaces the Gemini reading the owner took out on 13 Oct 2026 (*"it simply
   never works"*): what reads the page is new, what the app does with the reading is the reader it always had.

   - The key is the device's (`sep_inv_claude_key`, typed in Settings → Connections), never the book's, a backup's or GitHub's,
     as the metals.dev key. The photo goes from the browser straight to Anthropic (the browser header below); nothing else does.
   - One request a photo: the picture shrunk to 1,568 px on its long edge (where Claude reads it at full detail), the prompt
     and a JSON schema the answer must follow (structured outputs). Claude only TRANSCRIBES: times, figures and spellings as
     written. Adding up, the START rule, the gauge and part rules are the app's own reader (prodFromRegisterRead), in code.
   - What a read cost is kept on the device (`sep_inv_claude_spent`) from the answer's own token counts, at Opus 5.5's price,
     so Settings can say how much of the credit the photos have used.
   - Raw `fetch`, no SDK: the app is one file with no packages, and a library loaded from elsewhere into a page that holds the
     book is a risk the app has never taken.
*/
var PH_KEY = 'sep_inv_claude_key';
var PH_SPENT_KEY = 'sep_inv_claude_spent';
var PH_NOFB_KEY = 'sep_inv_claude_nofallback';
var PH_MODEL = 'claude-opus-5-5';
var PH_URL = 'https://api.anthropic.com/v1/messages';
var PH_VERSION = '2026-10-21';
var PH_FALLBACK_BETA = 'server-side-fallback-2026-07-01';
var PH_MAX_EDGE = 1568;
var PH_TIMEOUT_MS = 180000;
// Opus 5.5's price a million tokens (input, output), for the device's running figure. Thinking is billed as output.
var PH_PRICE = { input: 4, output: 20 };
// What a photo is expected to cost, said before many are read: about 3,000 tokens in and 2,000 out.
var PH_EST_USD = 0.05;

function phKey() { try { return localStorage.getItem(PH_KEY) || ''; } catch (e) { return ''; } }
function phKeySet(k) { try { if (k) localStorage.setItem(PH_KEY, k); else localStorage.removeItem(PH_KEY); } catch (e) { /* the key stays unset */ } }
function phSpent() {
  try { var s = JSON.parse(localStorage.getItem(PH_SPENT_KEY) || 'null'); if (s && typeof s.usd === 'number') return s; } catch (e) { /* none */ }
  return { usd: 0, n: 0, since: null };
}
function phSpentAdd(usd) {
  var s = phSpent();
  s.usd = Math.round((s.usd + usd) * 1e6) / 1e6; s.n++; if (!s.since) s.since = localDateStr();
  try { localStorage.setItem(PH_SPENT_KEY, JSON.stringify(s)); } catch (e) { /* the figure is a convenience */ }
}
function phUsd(usage) {
  if (!usage) return 0;
  var inp = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.05;
  return (inp * PH_PRICE.input + (usage.output_tokens || 0) * PH_PRICE.output) / 1e6;
}
function phMoney(usd) { return usd < 0.995 ? Math.max(1, Math.round(usd * 100)) + '¢' : '$' + usd.toFixed(2); }
/* The figure Settings and a batch say: "12 photos read · $0.61 of the credit". */
function phSpentSay() {
  var s = phSpent();
  return s.n ? todoPlural(s.n, 'photo') + ' read on this device · ' + phMoney(s.usd) + (s.since ? ' since ' + formatDate(s.since) : '') : 'no photo read yet';
}

/* A JSON-schema field that may be empty. */
function phNull(t) { return { anyOf: [{ type: t }, { type: 'null' }] }; }
function phObj(props) { return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }; }

/* The picture as a JPEG no longer than PH_MAX_EDGE on its long edge, turned upright as the camera recorded it. */
async function phShrink(blob) {
  var bmp = null, w, h, src;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); w = bmp.width; h = bmp.height; src = bmp; } catch (e) { bmp = null; }
  if (!bmp) {
    var url = URL.createObjectURL(blob);
    try {
      src = await new Promise(function(ok, no) { var im = new Image(); im.onload = function() { ok(im); }; im.onerror = function() { no(new Error('the photo could not be opened')); }; im.src = url; });
      w = src.naturalWidth; h = src.naturalHeight;
    } finally { setTimeout(function() { URL.revokeObjectURL(url); }, 0); }
  }
  var k = Math.min(1, PH_MAX_EDGE / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  var c = document.createElement('canvas'); c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(src, 0, 0, cw, ch);
  if (bmp && bmp.close) bmp.close();
  var data = c.toDataURL('image/jpeg', 0.85);
  return { b64: data.slice(data.indexOf(',') + 1), w: cw, h: ch };
}

/* One photo read: { ok: true, json, meta: {model, w, h, usage, usd} } or { ok: false, code, error }. The codes: key (none, or
   refused), billing (the credit is used up), quota (too many at once), busy (Anthropic overloaded), refused (a safety decline),
   truncated, json, network, timeout, api. */
async function phRead(blob, prompt, schema) {
  var key = phKey();
  if (!key) return { ok: false, code: 'key', error: 'No Claude key is set on this device (Settings → Connections → Photo reading).' };
  var img;
  try { img = await phShrink(blob); } catch (e) { return { ok: false, code: 'image', error: (e && e.message) || 'the photo could not be opened' }; }
  var noFb = false;
  try { noFb = localStorage.getItem(PH_NOFB_KEY) === '1'; } catch (e) { /* send it */ }
  var send = async function(withFb) {
    var body = { model: PH_MODEL, max_tokens: 16000,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: schema } },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.b64 } }, { type: 'text', text: prompt }] }] };
    var headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': PH_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' };
    // A safety decline is re-run on another model inside the same call (the server's fallbacks), rather than lost.
    if (withFb) { body.fallbacks = 'default'; headers['anthropic-beta'] = PH_FALLBACK_BETA; }
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function() { ctl.abort(); }, PH_TIMEOUT_MS) : null;
    try { return await fetch(PH_URL, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, cache: 'no-store' }); }
    finally { if (timer) clearTimeout(timer); }
  };
  var res, data;
  try {
    res = await send(!noFb);
    data = await res.json().catch(function() { return null; });
    // An account the fallbacks are not open to is asked once more without them, and the device remembers.
    if (!noFb && res.status === 400 && data && data.error && /fallback|beta/i.test(data.error.message || '')) {
      try { localStorage.setItem(PH_NOFB_KEY, '1'); } catch (e) { /* asked again next time */ }
      res = await send(false);
      data = await res.json().catch(function() { return null; });
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, code: 'timeout', error: 'Claude did not answer in ' + Math.round(PH_TIMEOUT_MS / 60000) + ' minutes. Read the photo again.' };
    return { ok: false, code: 'network', error: navigator.onLine === false ? 'The device is offline.' : 'Anthropic could not be reached (' + ((e && e.message) || 'network') + ').' };
  }
  return phAnswer(res.status, data, img);
}
/* The answer read: the error said in the shop's words, else the JSON the schema asked for. */
function phAnswer(status, data, img) {
  var err = data && data.error ? (data.error.message || data.error.type || '') : '';
  if (status === 401 || status === 403) return { ok: false, code: 'key', error: 'Anthropic refused the key on this device. Check it in Settings → Connections → Photo reading.' };
  if (status === 402 || /credit balance|billing/i.test(err)) return { ok: false, code: 'billing', error: 'The Claude credit is used up. Add credit at console.anthropic.com, then read the photo again.' };
  if (status === 429) return { ok: false, code: 'quota', error: 'Too many photos at once. Wait a minute and read it again.' };
  if (status === 529 || status >= 500) return { ok: false, code: 'busy', error: 'Anthropic is busy just now. Read the photo again in a minute.' };
  if (status !== 200 || !data) return { ok: false, code: 'api', error: err || ('Anthropic answered ' + status + '.') };
  var meta = { model: data.model || PH_MODEL, w: img.w, h: img.h, usage: data.usage || null, usd: phUsd(data.usage) };
  if (meta.usd) phSpentAdd(meta.usd);
  if (data.stop_reason === 'refusal') return { ok: false, code: 'refused', error: 'Claude declined to read this photo.', meta: meta };
  if (data.stop_reason === 'max_tokens') return { ok: false, code: 'truncated', error: 'The reading was cut off: the page may have too many rows. Try a photo of half the page.', meta: meta };
  var text = (data.content || []).filter(function(b) { return b && b.type === 'text'; }).map(function(b) { return b.text; }).join('');
  var json;
  try { json = JSON.parse(text); } catch (e) { return { ok: false, code: 'json', error: 'Claude did not return the table asked for. Read the photo again, or enter the page by hand.', meta: meta }; }
  return { ok: true, json: json, meta: meta };
}
/* A failed read said once, in a banner that stays. */
function phSayFail(what, res) { uiNotice(what + ': ' + (res && res.error || 'the photo could not be read'), 'error'); }

/* The key's section of Settings → Connections. */
function phSettingsBody() {
  return _sfg('Claude API key', 'setClaudeKey', _sKey('setClaudeKey', phKey(), 'sk-ant-...', 'invToggleClaudeKey')) +
    '<p class="inv-note inv-mt-8" data-ph-spent>' + escHtml(phSpentSay()) + '</p>';
}

/* ---------- The VAT register and its power log ---------- */
/* The prompt asks for a TRANSCRIPTION, never a reading: times as written, customers and parts as spelt, every row the clerk
   wrote, figures exactly as written ("72+10", "98×8+1"), struck rows and figures written over marked as such. No client list
   is sent (the model would "correct" the floor's spellings to legal names), and the workers' box is not asked for. The shape
   is the one prodFromRegisterRead has always read (prodparse.js). */
var PROD_REGISTER_PROMPT_VER = 'reg-c2';
var PROD_REGISTER_PROMPT = 'This is a photo of one page from the handwritten registers of a zinc electroplating plant in India. The photo may be sideways or upside down: read it the way the writing runs.\n\n' +
  'TRANSCRIBE the page exactly as written. Do not correct spellings, do not convert times, do not add up figures, do not add rows that are not written, do not invent anything.\n' +
  '- page: "production" if it lists batches plated (customer, part, times, figures); "power" if it is a log of power cuts and power coming back; "challan" if it is a customer\'s printed or handwritten delivery challan; "other" for anything else (a wages or hours sheet, a list of names).\n' +
  '- date: the date written at the top, exactly as written (e.g. "24/09/26"), else "". weekday: the day name written at the top (e.g. "Thursday"), else "".\n' +
  '- line: the line named at the top exactly as written (e.g. "VAT-A1", "VAT-A2", "BARREL"), else "".\n' +
  '- dayTotal: a day total written on the page, else null.\n' +
  '- rows: one per written row, top to bottom, skipping rows with nothing written but ditto marks. For each: time exactly as written without START or END (e.g. "9:45 AM", "3:00 PM"); ' +
  'mark: "START" or "END" if the row says so, else ""; customer and part as written (when a column holds only ditto marks, leave it "" and set ditto true); dim (a size such as "35x6") if written; ' +
  'qtyText: the figure written for the row, exactly as written with its signs (e.g. "72", "72+10", "98×8+1", "50+52+30", "3+4×156"), else ""; when the only figure on the row is written in the part column (e.g. "(25 NOS) TINA"), put it in qtyText too; struck: true if the row or its figure is struck through; ' +
  'over: what a correction was written over, as written; bracket: true if the row is inside a bracket carrying one total for several rows; ditto: true if the row\'s customer or part is only ditto marks; legible: false if you cannot read the figure, else true.\n' +
  '- On a power page, each row: date as written on the row, event "power cut" or "power in" (also "power on"), and time as written.\n' +
  'Ignore any box of workers\' names. A text field that is not written or does not apply is ""; struck, bracket and ditto are false unless the row shows them.';
/* The API compiles a schema's union-typed fields (anyOf, a type array) at a cost that grows fast, and refuses more than 16 of them
   (it refused the first register photo with 17, 3 Nov 2026). So a text not written is "" and a flag not set is false (legible
   true), never null: the reader treats both as absent (phRegisterJson drops ""), and the day total alone may be null. */
var PH_UNION_LIMIT = 16;
var PROD_REGISTER_SCHEMA = phObj({
  page: { type: 'string', enum: ['production', 'power', 'challan', 'other'] },
  date: { type: 'string' }, weekday: { type: 'string' }, line: { type: 'string' }, dayTotal: phNull('number'),
  rows: { type: 'array', items: phObj({
    time: { type: 'string' }, mark: { type: 'string', enum: ['START', 'END', ''] }, customer: { type: 'string' }, part: { type: 'string' },
    dim: { type: 'string' }, qtyText: { type: 'string' }, struck: { type: 'boolean' }, over: { type: 'string' }, bracket: { type: 'boolean' },
    ditto: { type: 'boolean' }, legible: { type: 'boolean' }, event: { type: 'string' }, date: { type: 'string' } }) }
});
/* The union-typed fields a schema holds, nested ones included: what PH_UNION_LIMIT counts. */
function phUnionCount(sch) {
  var n = 0, walk = function(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.anyOf || Array.isArray(x.type)) n++;
    Object.keys(x).forEach(function(k) { walk(x[k]); });
  };
  walk(sch); return n;
}
/* The reader's JSON as prodFromRegisterRead takes it: nulls left out, as the old reads were kept. */
function phRegisterJson(j) {
  var clean = function(o) { var out = {}; Object.keys(o || {}).forEach(function(k) { if (o[k] != null && o[k] !== '') out[k] = o[k]; }); return out; };
  var out = clean(j); out.rows = (Array.isArray(j && j.rows) ? j.rows : []).map(clean);
  return out;
}

/* ---------- A customer's challan ---------- */
/* No client is named in the prompt and no rate is asked for: the client is matched against the book's own clients and the
   line is priced from the client's own records (the challan form's rules), never from the paper. */
var SCAN_PROMPT = 'This is a photo of a customer\'s delivery challan sent with material to a zinc electroplating job-work plant in India. The photo may be sideways: read it the way the writing runs.\n\n' +
  'Transcribe it. Do not invent anything; leave a field null when it is not written.\n' +
  '- challanNo: the challan number as printed or written (e.g. "0041/26-27"). challanDate: its date as written (e.g. "04/08/2026"). clientName: the customer\'s name as printed at the top (the sender, not the plating plant). vehicleNo: the vehicle number if written.\n' +
  '- items: one per line of the challan. partNumber: the part or drawing number as written; desc: the description as written; ' +
  'when the challan has a pieces (Qty / Nos) column and a weight (Kg) column, qty is the weight in kg, nosQty the pieces and unit "KG"; when it has only pieces, qty and nosQty are the pieces and unit "NOS"; when it has only a weight, qty is the kg, nosQty null and unit "KG". amount: an amount written on the line, else null. Ignore the customer\'s own rate column.';
var SCAN_SCHEMA = phObj({
  challanNo: phNull('string'), challanDate: phNull('string'), clientName: phNull('string'), vehicleNo: phNull('string'),
  items: { type: 'array', items: phObj({ partNumber: phNull('string'), desc: phNull('string'), unit: { type: 'string', enum: ['KG', 'NOS'] },
    qty: phNull('number'), nosQty: phNull('number'), amount: phNull('number') }) }
});
