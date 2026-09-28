/* ===== VISION — one way to ask Gemini to read a photo ===== */
/* The challan scanner and the production register both send a photo and a prompt to Gemini with the key from
   Settings (sep_inv_gemini_key, never on S). geminiReadImage() is that one request. Called with no schema it sends
   exactly what the challan scanner always sent: the original bytes and the prompt, nothing else. A register read
   adds a JSON schema, a smaller image and a low thinking budget.

   It always resolves, never rejects: {ok, json, text, error, code}. `code` names what went wrong so each caller can
   say it in its own words: 'key' (no key), 'timeout', 'network', 'http' (with status), 'quota' (429), 'api' (Gemini's
   own error), 'blocked', 'truncated' (MAX_TOKENS), 'empty' (no text), 'json' (text that is not JSON). */
var GEMINI_MODEL = 'gemini-3.8-flash';
var GEMINI_TIMEOUT_MS = 90000;
/* Google retires models, and closes old ones to new keys first ("gemini-2.5-flash is no longer available to new
   users. Please update your code to use models/gemini-3.8-flash", owner's new key, 28 Sep 2026). The model a device
   uses is kept on the device: the default above, or the one Google named the last time it refused a model. */
var GEMINI_MODEL_KEY = 'sep_inv_gemini_model';
function geminiModel() { try { return localStorage.getItem(GEMINI_MODEL_KEY) || GEMINI_MODEL; } catch (e) { return GEMINI_MODEL; } }
function geminiSetModel(m) { try { if (m && m !== GEMINI_MODEL) localStorage.setItem(GEMINI_MODEL_KEY, m); else localStorage.removeItem(GEMINI_MODEL_KEY); } catch (e) { /* the default serves */ } }
/* The model Google's refusal names instead, when it refuses the one asked for as retired or unknown. */
function geminiModelMoved(error, asked) {
  var m = String(error || '');
  if (!/no longer available|not found|not supported|deprecated|retired|update your code/i.test(m)) return null;
  var to = (m.match(/use (?:models\/)?(gemini-[\w.-]*\w)/i) || [])[1];
  return to && to !== asked ? to : null;
}

function _geminiDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var r = new FileReader();
    r.onload = function(ev) { resolve(ev.target.result); };
    r.onerror = function() { reject(r.error || new Error('Could not read the file')); };
    r.readAsDataURL(file);
  });
}

/* A photo from a phone is 3–5 MB; the register's handwriting reads as well at 2,000 px on the long edge and the
   request is a fifth of the size. Only a register read asks for this; the challan scanner sends its bytes as they are. */
function _geminiShrink(dataUrl, maxEdge) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxEdge / Math.max(w, h || 1));
      try {
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ url: c.toDataURL('image/jpeg', 0.85), w: w, h: h });
      } catch (e) { resolve({ url: dataUrl, w: w, h: h }); }
    };
    img.onerror = function() { resolve({ url: dataUrl, w: 0, h: 0 }); };
    img.src = dataUrl;
  });
}

function geminiReadImage(file, prompt, opts) {
  opts = opts || {};
  var key = typeof getApiKey === 'function' ? getApiKey() : '';
  if (!key) return Promise.resolve({ ok: false, code: 'key', error: 'No Gemini key is set (Settings → Connections).' });
  var meta = { w: 0, h: 0, mime: file.type || 'image/jpeg' };
  return _geminiDataUrl(file).then(function(url) {
    return opts.maxEdge ? _geminiShrink(url, opts.maxEdge).then(function(s) { meta.w = s.w; meta.h = s.h; return s.url; }) : url;
  }).then(function(url) {
    var comma = url.indexOf(','), head = url.slice(0, comma);
    if (opts.maxEdge) meta.mime = (head.match(/^data:([^;]+)/) || [])[1] || meta.mime;
    var body = { contents: [{ parts: [{ inline_data: { mime_type: meta.mime, data: url.slice(comma + 1) } }, { text: prompt }] }] };
    if (opts.schema) {
      body.generationConfig = { responseMimeType: 'application/json', responseSchema: opts.schema, temperature: 0 };
      if (opts.thinkingBudget != null) body.generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
    }
    // One retry each, never a loop: a model Google names in place of a retired one (kept on the device), and a
    // request whose thinking setting the model will not take (sent again without it).
    var model = opts.model || geminiModel(), moved = false, thinkDropped = false;
    var go = function() {
      return _geminiSend(key, model, body).then(function(res) {
        if (res.code !== 'api' && res.code !== 'http') return res;
        var to = !moved && !opts.model ? geminiModelMoved(res.error, model) : null;
        if (to) { moved = true; res.movedFrom = model; model = to; return go().then(function(r2) { if (r2.ok) geminiSetModel(to); r2.movedFrom = res.movedFrom; return r2; }); }
        if (!thinkDropped && body.generationConfig && body.generationConfig.thinkingConfig && /thinking/i.test(res.error || '')) {
          thinkDropped = true; delete body.generationConfig.thinkingConfig; return go();
        }
        return res;
      });
    };
    return go().then(function(res) { meta.model = model; return geminiParse(res, !!opts.schema); });
  }).then(function(res) { res.meta = meta; return res; }, function(err) {
    return { ok: false, code: 'network', error: (err && err.message) || 'Could not read the file', meta: meta };
  });
}

/* One request to one model. Resolves with Gemini's reply ({data}) or what went wrong, never rejects. */
function _geminiSend(key, model, body) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var ms = (typeof window !== 'undefined' && window.GEMINI_TIMEOUT_MS) || GEMINI_TIMEOUT_MS;
    var timedOut = false, timer = setTimeout(function() { timedOut = true; if (ctl) ctl.abort(); }, ms);
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function(resp) {
      clearTimeout(timer);
      return resp.text().then(function(t) {
        var data = null;
        try { data = JSON.parse(t); } catch (e) { data = null; }
        if (resp.status === 429) return { ok: false, code: 'quota', status: 429, error: (data && data.error && data.error.message) || 'Too many requests' };
        if (data && data.error) return { ok: false, code: 'api', status: resp.status, error: data.error.message || 'Unknown' };
        if (!resp.ok) return { ok: false, code: 'http', status: resp.status, error: 'HTTP ' + resp.status };
        return { ok: true, data: data };
      });
    }, function(err) {
      clearTimeout(timer);
      return timedOut ? { ok: false, code: 'timeout', error: 'Gemini did not answer in ' + Math.round(ms / 1000) + ' s' }
        : { ok: false, code: 'network', error: (err && err.message) || 'Network error' };
    });
}
function geminiParse(res, wantJson) {
  if (!res.ok) return res;
  var out = geminiReadReply(res.data, wantJson);
  if (res.movedFrom) out.movedFrom = res.movedFrom;
  return out;
}

/* A reply's text and its JSON. The challan scanner's replies came back fenced as ```json … ``` before any schema was
   asked for, so the fence is stripped either way. */
function geminiReadReply(data, wantJson) {
  var cand = data && data.candidates && data.candidates[0];
  if (!cand) {
    var block = data && data.promptFeedback && data.promptFeedback.blockReason;
    return block ? { ok: false, code: 'blocked', error: 'Gemini declined the image (' + block + ')' } : { ok: false, code: 'empty', error: 'No response from Gemini' };
  }
  var text = '';
  ((cand.content && cand.content.parts) || []).forEach(function(p) { if (p.text) text += p.text; });
  if (cand.finishReason === 'MAX_TOKENS') return { ok: false, code: 'truncated', text: text, error: 'The reply was cut off before it finished' };
  if (!text) return { ok: false, code: 'empty', error: 'No response from Gemini' };
  var clean = text.replace(/```json|```/g, '').trim(), json = null;
  try { json = JSON.parse(clean); } catch (e) { return { ok: false, code: 'json', text: text, error: 'The reply was not the table asked for' }; }
  return { ok: true, json: json, text: text };
}
