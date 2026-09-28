/* ===== VISION — one way to ask Gemini to read a photo ===== */
/* The challan scanner and the production register both send a photo and a prompt to Gemini with the key from
   Settings (sep_inv_gemini_key, never on S). geminiReadImage() is that one request. Called with no schema it sends
   exactly what the challan scanner always sent: the original bytes and the prompt, nothing else. A register read
   adds a JSON schema, a smaller image and a low thinking budget.

   It always resolves, never rejects: {ok, json, text, error, code}. `code` names what went wrong so each caller can
   say it in its own words: 'key' (no key), 'timeout', 'network', 'http' (with status), 'quota' (429), 'api' (Gemini's
   own error), 'blocked', 'truncated' (MAX_TOKENS), 'empty' (no text), 'json' (text that is not JSON). */
var GEMINI_MODEL = 'gemini-2.5-flash';
var GEMINI_TIMEOUT_MS = 90000;

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
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var ms = (typeof window !== 'undefined' && window.GEMINI_TIMEOUT_MS) || GEMINI_TIMEOUT_MS;
    var timedOut = false, timer = setTimeout(function() { timedOut = true; if (ctl) ctl.abort(); }, ms);
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (opts.model || GEMINI_MODEL) + ':generateContent?key=' + encodeURIComponent(key), {
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
        return geminiReadReply(data, !!opts.schema);
      });
    }, function(err) {
      clearTimeout(timer);
      return timedOut ? { ok: false, code: 'timeout', error: 'Gemini did not answer in ' + Math.round(ms / 1000) + ' s' }
        : { ok: false, code: 'network', error: (err && err.message) || 'Network error' };
    });
  }).then(function(res) { res.meta = meta; return res; }, function(err) {
    return { ok: false, code: 'network', error: (err && err.message) || 'Could not read the file', meta: meta };
  });
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
