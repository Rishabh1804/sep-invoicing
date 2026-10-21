/* ===== THE WORLD OUTSIDE: NEWS, WEATHER AND TATA MOTORS (docs/UI_PASS_3.md §9b–§9e, §16) =====
   Owner, 15–16 Oct 2026: "live clock, weather, TATA Motors news - as everything boils down to their production and demand";
   "Tata Motors, Jamshedpur: monthly CV sales and the latest headlines + export sales as well … Prima division of Trucks, along
   with newer and earlier models"; "news Worker now". This module is the app's side of it. It draws no widget and no Home: it
   holds the data, asks the feeds Worker, and hands the widgets small functions to read (each listed below with its shape).

   - THE FEEDS. Two, news and weather, from the owner's own feeds Worker (server/feeds, §9a), at S.feedsCfg.url
     (https://feeds.somaelectro.co.in unless the owner moves it). Asked only when Home (or the sign-in screen) is drawn and the copy
     on the device is over 30 minutes old (feedEnsure, called by whoever draws them), or by a widget's Refresh (feedRefresh).
     Never in the background (a hidden page asks nothing, and nothing here keeps a timer), never offline, never more than once a
     minute a feed (the minute is kept on the device, so a reload does not ask again), and never under test unless a fixture says so
     (navigator.webdriver, as errors.js: a spec that opens Home must not reach the internet). An ask that has not answered in 8 s is
     a slow one and is dropped (I13).
   - THE COPY ON THE DEVICE (localStorage sep_inv_feeds: {news: {key, at, data, tried, why}, weather: {…}}), never in the book:
     headlines are not records. `key` is what was asked (the topics and models, or the place), `at` when it landed here, `data` the
     answer as read (every title, link and figure checked: a headline is untrusted text), `tried` the last ask, `why` how it failed.
     A failed ask keeps the copy. A weather copy for another place is not this plant's weather and is not shown.
   - WHAT LEAVES THE DEVICE: the four topics, the model words followed (S.market.models, as the Worker takes them) and the plant's
     place to two decimals. No record, no figure, no cookie, no referrer (the address bar names the screen and the record open). A
     failed ask is never an error report: every ask is caught here.
   - TATA'S MONTHS (S.market.tata, by month), THE PLANT'S CALENDAR (S.market.calendar, by day) and THE MODELS (S.market.models): the
     book's, typed by the owner in the Tata dialog (mktTataOpen), in the change log and the merge as records (CHG_TRACK under
     `market`). A headline that carries a month's figure or names the plant shut or working on a day is OFFERED there, never applied.
   - THE WEATHER DAYS (S.market.weather, by day, 400 kept): what each day was forecast, written when a weather answer lands. A fetched
     copy, so QUIET: the change log never compares it, and the merge keeps this device's, the other filling what it lacks, never held.
   - Settings → Connections → News and weather (FEED_SETTINGS_SEC), the To-do rule mktTata, the guide app-feeds (kbguides.js).

   WHAT THE WIDGETS CALL. Each feed function returns `state` (§7c: 'ok' something to draw; 'empty' answered, nothing in it; 'early'
   too little yet; 'notset' a setting needed, or a feed never reached from this device; 'offline' no copy and no way to one now;
   'loading' the first copy on its way) and, for any state but ok, `blank` ({kind, title, body, action: its door's HTML, Settings or
   the guide, '' with none}) ready for uiBlankHtml. An ok state carries the copy's age (`ago`, *from 2 h ago*), `offline` with no
   signal, `stale` where the Worker said its own upstream failed, `old` past 30 minutes and `failed` (why the last ask failed).
   - feedNews(opts) · feedWeather() · feedThunderToday() · feedWeatherCutDays() · feedAge(kind) · feedDayViz() / feedWeatherVizHtml()
   - mktTataLatest() · mktTataMonths(field, n) · mktPlantWeek(from) · mktOffers(month) · feedNewsItemHtml(item) · mktTataOpen(month)
   - feedEnsure() · feedRefresh(kind); a `sep-feeds` event on document ({kind, busy} as an ask starts, {kind, ok, why} as it ends),
     so a board can redraw its feed widgets when a copy lands. */

var FEED_STORE_KEY = 'sep_inv_feeds';
var FEED_FRESH_MS = 30 * 60000;     // a copy older than this is asked for again when Home is drawn
var FEED_GAP_MS = 60000;            // never more than once a minute a feed
var FEED_TIMEOUT_MS = 8000;         // an ask not answered by then is slow, and dropped (I13)
var FEED_MAX_CHARS = 400000;        // an answer longer than this is not the feeds Worker's
var FEED_KINDS = ['news', 'weather'];
/* The Worker's topics (§9a), in the order the news is read: its id and what a person calls it. */
var FEED_TOPICS = [['tata-cv', 'Sales'], ['tata-plant', 'Jamshedpur'], ['tata-models', 'The models'], ['tata-exports', 'Exports']];
/* The credits each feed asks for, written here: never a link a feed sent. */
var FEED_CREDIT = {
  news: { name: 'The GDELT Project', url: 'https://www.gdeltproject.org/' },
  weather: { name: 'MET Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0' }
};
/* A model word as the Worker takes it (§9a): letters, digits, spaces and dots, 16 characters at most; 8 words at most. */
var MKT_MODEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9 .]{0,14}[A-Za-z0-9.])?$/;
var MKT_MODELS_MAX = 8;
var MKT_WEATHER_KEEP = 400;          // weather days kept (§9d)
var MKT_WEATHER_EARLY = 30;          // days kept before the cut days and the rain are set side by side
var MKT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var MKT_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MKT_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/* The month's figures, as Tata's release prints them, this year's and the same month a year before (§9c), in units. */
var MKT_FIGS = [
  { key: 'cvTotal', label: 'All CVs', say: 'CVs', what: 'all commercial vehicles, in India and exported' },
  { key: 'cvDomestic', label: 'CVs in India', say: 'CVs in India', what: 'commercial vehicles sold in India' },
  { key: 'cvExport', label: 'CV exports', say: 'CV exports', what: 'commercial vehicles exported' },
  { key: 'hcv', label: 'Heavy trucks', say: 'heavy trucks', what: 'heavy trucks sold in India' }
];
var MKT_FIG_MAX = 9999999;

var _feedBusy = { news: null, weather: null };   // the ask in flight, a feed
var _mktDlg = null;                               // the Tata dialog open: {month, model (the headlines' filter), calShow}

// The book's shape is state.js's: feedsCfg a config filled key by key (STATE_CONFIGS), S.market a container whose four stores
// ensureStateShape repairs.

/* ---------- The settings ---------- */
var _feedDefaults = null;
function feedDefaults() { return _feedDefaults || (_feedDefaults = getDefaultState().feedsCfg); }
function feedNum(v, lo, hi) {
  var n = typeof v === 'number' ? v : v == null || String(v).trim() === '' ? NaN : Number(v);
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}
/* The Worker's address as the app asks it: https only (or a Worker run on this computer, for its own tests), no credentials,
   query or fragment, no trailing slash. '' when it is not one. */
function feedUrlOk(u) {
  var x;
  try { x = new URL(String(u || '').trim()); } catch (e) { return ''; }
  var local = x.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(x.hostname);
  if ((x.protocol !== 'https:' && !local) || x.username || x.password) return '';
  return (x.origin + x.pathname).replace(/\/+$/, '');
}
/* What the feeds are set to: on (the default), the address, and the plant's place. The place is the feeds' own where typed, else the
   Office QR's (S.checkinCfg, checkin.js), else the company's address placed on the map (feedGeoRec, owner, 21 Oct 2026: "we have the
   location for our plant available in the database, yet it asks to set the plant place"), each read here and never copied into the
   book; with none, the weather is not set. */
function feedCfg() {
  var c = (S && S.feedsCfg) || {}, ck = (S && S.checkinCfg) || {}, name = String(c.place || '').trim().slice(0, 40);
  var lat = feedNum(c.lat, -90, 90), lon = feedNum(c.lon, -180, 180), from = '';
  if (lat != null && lon != null) from = 'feeds';
  else {
    lat = feedNum(ck.lat, -90, 90); lon = feedNum(ck.lng, -180, 180);
    if (lat != null && lon != null) from = 'checkin';
    else {
      var g = feedGeoRec();
      if (g) { lat = g.lat; lon = g.lon; from = 'address'; if (!name) name = g.name; } else lat = lon = null;
    }
  }
  var blank = c.url == null || String(c.url).trim() === '';
  return { on: c.on !== false, url: blank ? feedDefaults().url : feedUrlOk(c.url), lat: lat, lon: lon,
    place: name, placeFrom: from };
}

/* ---------- The plant's place from the company's address (OpenStreetMap's Nominatim) ----------
   The address on every invoice (S.company) placed on the map once, the answer kept on this device beside the feeds' copies
   (sep_inv_feeds.geo: {key (the address as asked), lat, lon, name, at, tried, why}) and never in the book: a phone looks it up once,
   and a changed address is looked up again. Nominatim's terms: at most one ask a second, the site named (the referrer), and an
   answer cached: here at most three asks, 1.2 s apart, once an address (a day apart after one that found nothing). The address is
   asked from its plainest parts: the parts with no figure in them (8-B, 1st Phase and the PIN code left out), the locality with
   its town first ("Adityapur, Jamshedpur"), then all of them, then the town. The weather wants about a kilometre (two decimals). */
var FEED_GEO_URL = 'https://nominatim.openstreetmap.org/search';
var FEED_GEO_RETRY_MS = 24 * 3600000;
var _feedGeoBusy = null;
function feedGeoParts() {
  var co = (S && S.company) || {};
  return [co.add1, co.add2, co.add3].join(',').split(/\s*(?:,|\s-\s|\n)\s*/).map(function(x) { return String(x || '').replace(/\s+/g, ' ').trim(); })
    .filter(function(x) { return x && !/\d/.test(x) && x.length <= 40; });
}
function feedGeoKey() { var parts = feedGeoParts(); return parts.length ? parts.join(', ').toLowerCase() : ''; }
/* The address placed, for the address as it now reads; null when it was not, or not yet. */
function feedGeoRec() {
  var r = feedStoreRec('geo'), key = feedGeoKey();
  return r && key && r.key === key && feedNum(r.lat, -90, 90) != null && feedNum(r.lon, -180, 180) != null ? r : null;
}
/* The asks, plainest first: the locality and its town, every part, the town. */
function feedGeoQueries() {
  var parts = feedGeoParts(), q = [];
  if (parts.length >= 2) q.push(parts.slice(-2).join(', '));
  if (parts.length > 2) q.push(parts.join(', '));
  if (parts.length) q.push(parts[parts.length - 1]);
  return q.filter(function(x, i) { return q.indexOf(x) === i; });
}
/* Looks the address up when it has no place yet (and none typed or from the Office QR); resolves {ok} or {ok: false, why}. Under
   test only when a fixture says so (window.__sepGeoOn), since a spec must not reach the internet. */
function feedGeoEnsure() {
  if (_feedGeoBusy) return _feedGeoBusy;
  var c = (S && S.feedsCfg) || {}, ck = (S && S.checkinCfg) || {};
  if (feedNum(c.lat, -90, 90) != null || feedNum(ck.lat, -90, 90) != null) return Promise.resolve({ ok: false, why: 'set' });
  var key = feedGeoKey(), rec = feedStoreRec('geo') || {}, now = Date.now();
  if (!key) return Promise.resolve({ ok: false, why: 'noaddress' });
  if (rec.key === key && (rec.lat != null || (rec.tried && now - rec.tried < FEED_GEO_RETRY_MS))) return Promise.resolve({ ok: rec.lat != null });
  if (!feedOnline() || feedHidden()) return Promise.resolve({ ok: false, why: 'offline' });
  try { if (navigator.webdriver && window.__sepGeoOn !== true) return Promise.resolve({ ok: false, why: 'test' }); } catch (e) { /* none */ }
  var qs = feedGeoQueries(), i = 0, parts = feedGeoParts();
  feedStorePut('geo', { key: key, tried: now });
  var next = function() {
    if (i >= qs.length) return Promise.resolve(null);
    var q = qs[i++], wait = i > 1 ? new Promise(function(res) { setTimeout(res, 1200); }) : Promise.resolve();
    return wait.then(function() {
      return feedGet(FEED_GEO_URL + '?format=jsonv2&limit=1&countrycodes=in&q=' + encodeURIComponent(q), { referrer: true });
    }).then(function(r) {
      var hit = null;
      if (r.ok) { try { var j = JSON.parse(r.text); hit = Array.isArray(j) && j[0] ? j[0] : null; } catch (e) { hit = null; } }
      var lat = hit ? feedNum(Number(hit.lat), -90, 90) : null, lon = hit ? feedNum(Number(hit.lon), -180, 180) : null;
      return lat != null && lon != null ? { lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000, q: q } : next();
    });
  };
  _feedGeoBusy = next().then(function(hit) {
    var name = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '';
    feedStorePut('geo', hit ? { key: key, lat: hit.lat, lon: hit.lon, name: name.slice(0, 40), asked: hit.q, at: Date.now(), tried: now }
      : { key: key, tried: now, why: 'notfound' });
    _feedGeoBusy = null;
    if (hit) feedTell({ kind: 'weather', place: true });
    return { ok: !!hit };
  }).catch(function() { _feedGeoBusy = null; return { ok: false, why: 'unreachable' }; });
  return _feedGeoBusy;
}
/* Under test the feeds stay quiet, as errors.js does, unless a fixture asks for them (P225's feedsOn). */
function feedLive() { try { return !navigator.webdriver || window.__sepFeedsOn === true; } catch (e) { return true; } }
function feedOnline() { try { return navigator.onLine !== false; } catch (e) { return true; } }
function feedHidden() { try { return !!document.hidden; } catch (e) { return false; } }

/* ---------- The copy on the device ---------- */
function feedStoreRead() {
  try { var v = JSON.parse(localStorage.getItem(FEED_STORE_KEY) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function feedStoreRec(kind) { var r = feedStoreRead()[kind]; return r && typeof r === 'object' && !Array.isArray(r) ? r : null; }
function feedStorePut(kind, rec) {
  try { var all = feedStoreRead(); all[kind] = rec; localStorage.setItem(FEED_STORE_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
}
/* The news copy, whatever it was asked with (a model added since still shows yesterday's headlines until the new copy lands). */
function feedNewsRec() {
  var r = feedStoreRec('news');
  return r && r.data && typeof r.data === 'object' && r.data.topics && typeof r.data.topics === 'object' ? r : null;
}
/* The weather copy for this plant's place only. */
function feedWeatherRec() {
  var r = feedStoreRec('weather'), key = feedWeatherQuery();
  return r && key && r.key === key && r.data && Array.isArray(r.data.hours) && Array.isArray(r.data.days) ? r : null;
}

/* ---------- What is asked ---------- */
/* The models followed, as the Worker takes them: valid words, each once, eight at most. */
function mktModelsSent() {
  var seen = {}, out = [];
  (Array.isArray(mktRead().models) ? mktRead().models : []).forEach(function(w) {
    w = String(w == null ? '' : w).replace(/\s+/g, ' ').trim();
    var k = w.toLowerCase();
    if (!MKT_MODEL_RE.test(w) || seen[k] || out.length >= MKT_MODELS_MAX) return;
    seen[k] = 1; out.push(w);
  });
  return out;
}
/* The query of the news: its topics (the models' only with a model to ask about) and the model words. */
function feedNewsQuery() {
  var models = mktModelsSent();
  var topics = FEED_TOPICS.map(function(t) { return t[0]; }).filter(function(t) { return t !== 'tata-models' || models.length; });
  return 'topics=' + topics.join(',') + (models.length ? '&models=' + models.map(encodeURIComponent).join(',') : '');
}
/* The query of the weather: the plant's place to two decimals (about a kilometre), else '' (not set). */
function feedWeatherQuery() {
  var c = feedCfg();
  return c.lat == null || c.lon == null ? '' : 'lat=' + c.lat.toFixed(2) + '&lon=' + c.lon.toFixed(2);
}
function feedKey(kind) { return kind === 'weather' ? feedWeatherQuery() : feedNewsQuery(); }
/* Why a feed is not asked now, or '' when it may be. */
function feedBlocked(kind) {
  var c = feedCfg();
  if (!c.on) return 'off';
  if (!c.url) return 'nourl';
  if (kind === 'weather' && !feedWeatherQuery()) return 'noplace';
  if (!feedOnline()) return 'offline';
  if (!feedLive()) return 'test';
  if (feedHidden()) return 'hidden';
  return '';
}

/* ---------- Asking ---------- */
/* One GET answered within FEED_TIMEOUT_MS (or `o.timeout`): {ok, text} or {ok: false, why: 'refused' (an HTTP error, with its
   status) | 'slow' | 'unreachable' (no answer: no network, a wrong address, or the server not allowing this app) | 'nonsense'}.
   `o.referrer`: the site is named (strict-origin: https://rishabh1804.github.io/, never the screen), as Nominatim and MET Norway ask
   a browser to say who is asking; otherwise no referrer. Never throws, and never reports: a feed failing is not the app failing. */
function feedGet(url, o) {
  o = o || {};
  var slow = false, ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function() { slow = true; if (ctl) ctl.abort(); }, o.timeout || FEED_TIMEOUT_MS);
  var opts = { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: o.referrer ? 'strict-origin' : 'no-referrer' };
  if (ctl) opts.signal = ctl.signal;
  var p;
  try { p = fetch(url, opts); } catch (e) { p = Promise.reject(e); }
  return p.then(function(res) {
    if (!res.ok) return { ok: false, why: 'refused', status: res.status };
    return res.text().then(function(t) {
      if (slow) return { ok: false, why: 'slow' };
      if (typeof t !== 'string' || t.length > FEED_MAX_CHARS) return { ok: false, why: 'nonsense' };
      return { ok: true, text: t };
    });
  }).catch(function() { return { ok: false, why: slow ? 'slow' : 'unreachable' }; })
    .then(function(r) { clearTimeout(timer); return r; });
}
/* One GET to the feeds service: {ok, json}, else as feedGet. */
function feedAsk(base, path, query) {
  return feedGet(base + path + (query ? '?' + query : '')).then(function(r) {
    if (!r.ok) return r;
    try { return { ok: true, json: JSON.parse(r.text) }; } catch (e) { return { ok: false, why: 'nonsense' }; }
  });
}
function feedSleep(ms) { return new Promise(function(res) { setTimeout(res, ms); }); }

/* ---------- Straight from the sources (owner, 21 Oct 2026: "Ask the sources directly") ----------
   The feeds service (S.feedsCfg.url, server/feeds) was never set up, so nothing ever arrived. Where it cannot be reached, the app
   asks the sources itself, as the service would and in its shape (server/feeds/src/news.js, weather.js), each answer then read by
   the same checks as the service's (feedNormNews, feedNormWeather): GDELT's DOC 2.0 for the news (open to a browser; its topics
   asked 6 s apart, as it asks) and MET Norway's forecast for the weather (open to a browser, the site named). What leaves the
   device is the same: the topics, the model words and the plant's place to two decimals. Once the service cannot be reached, it is
   not asked again for six hours (sep_inv_feeds.direct); one that answers is used whenever it does. Under test only where a fixture
   says so (window.__sepFeedsDirect), so a spec never reaches the internet. */
var FEED_GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
var FEED_MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
var FEED_DIRECT_HOLD_MS = 6 * 3600000;
var FEED_GDELT_GAP_MS = 6000;
var FEED_GDELT_Q = {
  'tata-cv': function() { return '"tata motors" (sales OR trucks OR "commercial vehicles") sourcecountry:IN'; },
  'tata-plant': function() { return '"tata motors" jamshedpur'; },
  'tata-models': function(models) {
    var p = models.map(function(m) { return '"tata ' + String(m).toLowerCase() + '"'; });
    return p.length > 1 ? '(' + p.join(' OR ') + ')' : p[0];
  },
  'tata-exports': function() { return '"tata motors" (exports OR "international business")'; }
};
function feedDirectOk() { try { return !navigator.webdriver || window.__sepFeedsDirect === true; } catch (e) { return true; } }
/* A headline as a person reads it: its tags dropped and its entities decoded by an inert parse (nothing in it runs or loads),
   then one line of 200 characters at most. Drawn later through escHtml like every headline. */
function feedHeadline(raw) {
  if (typeof raw !== 'string') return '';
  var text = function(s) { return new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html').body.textContent || ''; }, t;
  // Tags written as entities (&lt;b&gt;) are tags once decoded: a second parse drops them, as the service's reader does.
  try { t = text(raw); if (/<\/?[A-Za-z][^<>]*>/.test(t)) t = text(t); } catch (e) { t = raw.replace(/<[^>]*>/g, ' '); }
  return feedText(t, 200);
}
/* GDELT has sent JSON a strict reader refuses (a raw control character, a stray backslash): read strictly, else mended once. */
function feedLooseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    try {
      return JSON.parse(String(text).replace(/[\u0000-\u001f]/g, ' ').replace(/\\(.?)/g, function(w, n) { return n && '"\\/bfnrtu'.indexOf(n) >= 0 ? w : n; }));
    } catch (e2) { return undefined; }
  }
}
/* GDELT's article list as the service's items: at most 25, newest first, each title and link once. null when it is not one. */
function feedGdeltItems(text) {
  var j = feedLooseJson(text);
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  if (!Array.isArray(j.articles)) return Object.keys(j).length ? null : [];
  var seen = {}, out = [];
  j.articles.forEach(function(a) {
    if (out.length >= 25 || !a || typeof a !== 'object') return;
    var url = feedSafeUrl(a.url), title = feedHeadline(a.title), k = title.toLowerCase().replace(/[^0-9a-z\u00c0-\uffff]+/g, ' ').trim();
    if (!url || !title || seen['t' + k] || seen['u' + url]) return;
    seen['t' + k] = seen['u' + url] = 1;
    out.push({ title: title, url: url, source: feedHost(url), at: feedIso(a.seendate), lang: feedText(a.language, 24) });
  });
  return out;
}
/* The news straight from GDELT: each topic asked in turn, 6 s apart. A topic that fails keeps what the last copy had. */
function feedDirectNews() {
  var models = mktModelsSent(), topics = FEED_TOPICS.map(function(t) { return t[0]; }).filter(function(t) { return t !== 'tata-models' || models.length; });
  var prev = feedNewsRec(), had = prev && prev.data && prev.data.topics ? prev.data.topics : {};
  var out = { at: new Date().toISOString(), topics: {} }, got = 0, i = 0, last = null;
  var step = function() {
    if (i >= topics.length) return Promise.resolve(got ? { ok: true, json: out } : last || { ok: false, why: 'unreachable' });
    var id = topics[i++], url = FEED_GDELT_URL + '?query=' + encodeURIComponent(FEED_GDELT_Q[id](models)) + '&mode=ArtList&format=json&maxrecords=25&timespan=14d&sort=DateDesc';
    return (i > 1 ? feedSleep(FEED_GDELT_GAP_MS) : Promise.resolve()).then(function() { return feedGet(url, { timeout: 12000 }); }).then(function(r) {
      var items = r.ok ? feedGdeltItems(r.text) : null;
      if (items) { got++; out.topics[id] = { at: new Date().toISOString(), items: items }; }
      else { last = r.ok ? { ok: false, why: 'nonsense' } : r; if (had[id]) out.topics[id] = had[id]; }
      return step();
    });
  };
  return step();
}
/* MET Norway's compact forecast as the service answers it (weather.js readForecast, weatherAnswer): the next 48 hours with an
   hour's forecast, and 7 days by India's calendar day (UTC+5:30), a day's figures from its steps ahead of now. null when it
   holds no forecast. */
function feedMetAnswer(j, nowMs) {
  var props = j && typeof j === 'object' ? j.properties : null, steps = props && Array.isArray(props.timeseries) ? props.timeseries : null;
  if (!steps) return null;
  var HOUR = 3600000, DAY = 86400000, IST = 330 * 60000;
  var n = function(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : undefined; };
  var per = function(p) {
    if (!p || typeof p !== 'object') return undefined;
    var o = {}, sym = p.summary && p.summary.symbol_code, d = p.details && typeof p.details === 'object' ? p.details : {};
    if (typeof sym === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(sym)) o.sym = sym;
    if (n(d.precipitation_amount, 0, 1000) !== undefined) o.rain = d.precipitation_amount;
    if (n(d.air_temperature_max, -100, 70) !== undefined) o.tmax = d.air_temperature_max;
    if (n(d.air_temperature_min, -100, 70) !== undefined) o.tmin = d.air_temperature_min;
    return Object.keys(o).length ? o : undefined;
  };
  var series = [];
  steps.forEach(function(s) {
    if (!s || typeof s.time !== 'string') return;
    var t = Date.parse(s.time);
    if (!isFinite(t)) return;
    var d = s.data && typeof s.data === 'object' ? s.data : {}, row = { t: t };
    var temp = n(d.instant && d.instant.details && d.instant.details.air_temperature, -100, 70);
    if (temp !== undefined) row.temp = temp;
    var p1 = per(d.next_1_hours), p6 = per(d.next_6_hours), p12 = per(d.next_12_hours);
    if (p1) row.p1 = p1;
    if (p6) row.p6 = p6;
    if (p12) row.p12 = p12;
    series.push(row);
  });
  if (!series.length) return null;
  series.sort(function(a, b) { return a.t - b.t; });
  var iso = function(ms) { return new Date(ms).toISOString(); }, indiaDate = function(ms) { return iso(ms + IST).slice(0, 10); };
  var from = Math.floor(nowMs / HOUR) * HOUR, ahead = series.filter(function(s) { return s.t >= from; });
  var hours = [];
  ahead.forEach(function(s) {
    if (!s.p1 || hours.length >= 48) return;
    hours.push({ t: iso(s.t), temp: s.temp != null ? s.temp : null, symbol: s.p1.sym || null, rain: s.p1.rain != null ? s.p1.rain : null });
  });
  var byDate = {}, dayOf = function(date) { return byDate[date] || (byDate[date] = { date: date, tMax: null, tMin: null, rain: null, thunder: false, symbol: null, rank: 9 }); };
  var temp = function(d, v) { if (d.tMax === null || v > d.tMax) d.tMax = v; if (d.tMin === null || v < d.tMin) d.tMin = v; };
  var symbol = function(d, sym, rank) { if (sym && rank < d.rank) { d.symbol = sym; d.rank = rank; } };
  var covered = -Infinity;
  ahead.forEach(function(s) {
    if (s.temp !== undefined) temp(dayOf(indiaDate(s.t)), s.temp);
    var p = null, len = 0;
    if (s.p1) { p = s.p1; len = HOUR; } else if (s.p6) { p = s.p6; len = 6 * HOUR; } else if (s.p12) { p = s.p12; len = 12 * HOUR; }
    if (p && s.t >= covered) {
      covered = s.t + len;
      var d = dayOf(indiaDate(s.t + len / 2));
      if (p.rain !== undefined) d.rain = (d.rain || 0) + p.rain;
      if (p.tmax !== undefined) temp(d, p.tmax);
      if (p.tmin !== undefined) temp(d, p.tmin);
      if (p.sym && p.sym.indexOf('thunder') >= 0) d.thunder = true;
      symbol(d, p.sym, 3);
    }
    var ofDay = ((s.t % DAY) + DAY) % DAY;
    if (ofDay === 0 && s.p12) symbol(dayOf(indiaDate(s.t)), s.p12.sym, 1);
    else if (ofDay === 6 * HOUR && s.p6) symbol(dayOf(indiaDate(s.t)), s.p6.sym, 2);
  });
  var today = indiaDate(nowMs), round1 = function(x) { return Math.round(x * 10) / 10; };
  var days = Object.keys(byDate).sort().filter(function(k) { return k >= today; }).slice(0, 7).map(function(k) {
    var d = byDate[k];
    return { date: d.date, tMax: d.tMax === null ? null : round1(d.tMax), tMin: d.tMin === null ? null : round1(d.tMin),
      rain: d.rain === null ? null : round1(d.rain), thunder: d.thunder || !!(d.symbol && d.symbol.indexOf('thunder') >= 0), symbol: d.symbol };
  });
  var up = Date.parse(props.meta && props.meta.updated_at);
  return { at: iso(nowMs), updated: isFinite(up) ? iso(up) : null, hours: hours, days: days };
}
/* The weather straight from MET Norway, at the plant's place to two decimals. */
function feedDirectWeather() {
  var key = feedWeatherQuery();
  if (!key) return Promise.resolve({ ok: false, why: 'noplace' });
  return feedGet(FEED_MET_URL + '?' + key, { referrer: true, timeout: 12000 }).then(function(r) {
    if (!r.ok) return r;
    var j;
    try { j = JSON.parse(r.text); } catch (e) { return { ok: false, why: 'nonsense' }; }
    var w = feedMetAnswer(j, Date.now());
    return w ? { ok: true, json: w } : { ok: false, why: 'nonsense' };
  });
}
/* The service first, unless it could not be reached in the last six hours; where it cannot be (no answer, an answer that is not
   its own, or a 404 or 5xx: no service at the address), the sources themselves. The answer says which (`via`). */
function feedAskVia(kind, base, key) {
  var d = feedStoreRec('direct'), held = !!(d && d.at && Date.now() - d.at < FEED_DIRECT_HOLD_MS);
  var direct = function() { return (kind === 'news' ? feedDirectNews() : feedDirectWeather()).then(function(r) { r.via = 'direct'; return r; }); };
  if (held && feedDirectOk()) return direct();
  return feedAsk(base, '/' + kind, key).then(function(r) {
    if (r.ok) { if (d && d.at) feedStorePut('direct', {}); r.via = 'service'; return r; }
    var gone = r.why === 'unreachable' || r.why === 'nonsense' || (r.why === 'refused' && (r.status === 404 || r.status >= 500));
    if (!gone || !feedDirectOk()) return r;
    feedStorePut('direct', { at: Date.now(), why: r.why, status: r.status || null });
    return direct();
  });
}
/* A feed asked, its answer read and kept. Resolves {ok} or {ok: false, why, status, wait (seconds, for 'gap')}. One ask at a time a
   feed: a second call while one is in flight shares it. */
function feedFetch(kind) {
  if (FEED_KINDS.indexOf(kind) < 0) return Promise.resolve({ ok: false, why: 'nokind' });
  if (_feedBusy[kind]) return _feedBusy[kind];
  var why = feedBlocked(kind);
  if (why) return Promise.resolve({ ok: false, why: why });
  var rec = feedStoreRec(kind) || {}, now = Date.now();
  if (rec.tried && now >= rec.tried && now - rec.tried < FEED_GAP_MS) return Promise.resolve({ ok: false, why: 'gap', wait: Math.ceil((FEED_GAP_MS - (now - rec.tried)) / 1000) });
  var key = feedKey(kind), base = feedCfg().url;
  rec.tried = now;
  feedStorePut(kind, rec);
  var p = feedAskVia(kind, base, key).then(function(r) {
    var data = r.ok ? (kind === 'news' ? feedNormNews(r.json) : feedNormWeather(r.json)) : null;
    if (r.ok && !data) r = { ok: false, why: 'nonsense', via: r.via };
    var cur = feedStoreRec(kind) || {};
    if (r.ok) cur = { key: key, at: Date.now(), data: data, tried: cur.tried || now, why: '', via: r.via || 'service' };
    else { cur.why = r.why; cur.status = r.status || null; cur.failedAt = Date.now(); cur.failVia = r.via || 'service'; }
    feedStorePut(kind, cur);
    if (r.ok && kind === 'weather') mktWeatherKeep();
    return r.ok ? { ok: true, via: r.via || 'service' } : { ok: false, why: r.why, status: r.status || null, via: r.via || 'service' };
  }).catch(function() { return { ok: false, why: 'unreachable' }; }).then(function(res) {
    _feedBusy[kind] = null;
    feedTell({ kind: kind, ok: !!res.ok, why: res.why || '' });
    return res;
  });
  _feedBusy[kind] = p;
  feedTell({ kind: kind, busy: true });
  return p;
}
function feedTell(detail) {
  try { document.dispatchEvent(new CustomEvent('sep-feeds', { detail: detail })); } catch (e) { /* an old engine: the next draw reads the copy */ }
}
/* When Home (or the sign-in screen) is drawn: each feed whose copy is missing, asked with other words, or over 30 minutes old is
   asked, unless it may not be now (off, offline, hidden, under test, asked within the minute). Resolves when the asks end. */
function feedEnsure() {
  var asks = [];
  // No place for the weather yet: the company's address is looked up first (once), then the weather is asked at it.
  if (feedBlocked('weather') === 'noplace') asks.push(feedGeoEnsure().then(function(r) { return r && r.ok ? feedFetch('weather') : r; }));
  FEED_KINDS.forEach(function(kind) {
    if (feedBlocked(kind)) return;
    var rec = feedStoreRec(kind), now = Date.now();
    var fresh = rec && rec.data && rec.key === feedKey(kind) && rec.at && now >= rec.at && now - rec.at < FEED_FRESH_MS;
    if (!fresh) asks.push(feedFetch(kind));
  });
  return Promise.all(asks);
}
/* A widget's Refresh: the feed asked again now (both with no kind), within the same rules but the 30 minutes. */
function feedRefresh(kind) {
  if (!kind) return Promise.all(FEED_KINDS.map(feedFetch));
  return feedFetch(kind);
}

/* ---------- Reading an answer (untrusted text, every field checked) ---------- */
function feedText(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
/* A link the app will draw: http or https only, else ''. */
function feedSafeUrl(u) {
  u = typeof u === 'string' ? u.trim() : '';
  if (!/^https?:\/\//i.test(u) || u.length > 2000) return '';
  try { var x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch (e) { return ''; }
}
function feedHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
/* A time as ISO, from ISO or GDELT's own 20261014T053000Z; '' when it does not read. */
function feedIso(v) {
  if (typeof v !== 'string' || v.length > 40) return '';
  var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  var t = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.parse(v);
  return isFinite(t) ? new Date(t).toISOString() : '';
}
function feedSym(s) { return typeof s === 'string' && /^[a-z_]{1,60}$/.test(s) ? s : ''; }
function feedNormNews(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || !j.topics || typeof j.topics !== 'object' || Array.isArray(j.topics)) return null;
  var out = { at: feedIso(j.at), stale: j.stale === true, topics: {} }, any = false;
  FEED_TOPICS.forEach(function(t) {
    var tp = j.topics[t[0]];
    if (!tp || typeof tp !== 'object' || !Array.isArray(tp.items)) return;
    any = true;
    var seen = {};
    out.topics[t[0]] = { at: feedIso(tp.at), items: tp.items.slice(0, 60).map(function(it) {
      if (!it || typeof it !== 'object') return null;
      var title = feedText(it.title, 200), url = feedSafeUrl(it.url), k = title.toLowerCase();
      if (!title || !url || seen[k]) return null;
      seen[k] = 1;
      return { title: title, url: url, source: feedText(it.source, 80) || feedHost(url), at: feedIso(it.at), lang: feedText(it.lang, 24) };
    }).filter(Boolean).slice(0, 25) };
  });
  return any ? out : null;
}
function feedNormWeather(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || !Array.isArray(j.hours) || !Array.isArray(j.days)) return null;
  var num = function(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : null; };
  var hours = j.hours.slice(0, 72).map(function(h) {
    if (!h || typeof h !== 'object') return null;
    var t = feedIso(h.t), sym = feedSym(h.symbol), temp = num(h.temp, -70, 70);
    if (!t || temp == null) return null;
    return { t: t, temp: temp, symbol: sym, rain: num(h.rain, 0, 500) };
  }).filter(Boolean);
  var days = j.days.slice(0, 10).map(function(d) {
    if (!d || typeof d !== 'object' || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
    var sym = feedSym(d.symbol);
    return { date: d.date, tMax: num(d.tMax, -70, 70), tMin: num(d.tMin, -70, 70), rain: num(d.rain, 0, 2000),
      thunder: d.thunder === true || /thunder/.test(sym), symbol: sym };
  }).filter(Boolean);
  if (!hours.length && !days.length) return null;
  return { at: feedIso(j.at), updated: feedIso(j.updated), stale: j.stale === true, hours: hours, days: days };
}

/* ---------- What a state says (§7c) ---------- */
var FEED_WHY_TEXT = {
  refused: 'the feeds Worker refused the ask', slow: 'no answer in 8 seconds', unreachable: 'the feeds Worker could not be reached',
  nonsense: 'the answer was not the feeds Worker’s'
};
/* Asked of the sources themselves (feedAskVia), a failure is theirs: GDELT's or MET Norway's. */
var FEED_SOURCE = { news: 'GDELT', weather: 'MET Norway' };
function feedWhyText(why, status, via, kind) {
  if (via === 'direct') {
    var who = FEED_SOURCE[kind] || 'the source';
    return why === 'refused' ? who + ' answered ' + (status || 'no') : why === 'slow' ? who + ' did not answer in 12 seconds'
      : why === 'unreachable' ? who + ' could not be reached' : why === 'nonsense' ? who + ' sent what could not be read (it may be asking for a pause)' : '';
  }
  if (why === 'refused' && status) return 'the feeds Worker answered ' + status;
  return FEED_WHY_TEXT[why] || '';
}
function feedBlank(base, state, title, body) {
  return Object.assign(base, { state: state, blank: { kind: state, title: title, body: body || '' } });
}
var FEED_NAME = { news: 'news', weather: 'weather' };
/* The door a blank state offers (§7c `action`, HTML): Settings' section for an ID that may change it, else the guide for an ID that
   reads it, else none. */
function feedDoorHtml(to) {
  if (to === 'settings' && (typeof grdCan !== 'function' || grdCan('settings'))) {
    return '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFeedSettings">Settings</button>';
  }
  var g = typeof kbFind === 'function' ? kbFind('app-feeds') : null;
  return g && (typeof kbCanRead !== 'function' || kbCanRead(g)) ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFeedGuide">Guide</button>' : '';
}
/* No copy to show: why, said as a state. A feed never reached from this device whose ask found nothing is not set up yet (§9e):
   until the Worker answers once, that is the likeliest reason, and its guide says what to do. */
function feedNoCopy(base, kind, old) {
  var rec = feedStoreRec(kind), n = FEED_NAME[kind];
  if (_feedBusy[kind]) return feedBlank(base, 'loading', 'Fetching the ' + n + '…', '');
  if (!feedOnline()) return feedBlank(base, 'offline', 'Offline: the ' + n + ' comes back with a signal', '');
  if (!feedLive()) return feedBlank(base, 'offline', 'The ' + n + ' is not fetched in this browser', 'It is under test.');
  if (rec && rec.why) {
    var said = feedWhyText(rec.why, rec.status, rec.failVia, kind).replace(/^./, function(c) { return c.toUpperCase(); }) + (rec.failedAt ? ', ' + ghRelTime(rec.failedAt) : '');
    // Asked of the sources themselves and failed: nothing is to be set up; it is asked again with the next look at Home.
    if (!rec.at && rec.failVia === 'direct') return feedBlank(base, 'offline', 'The ' + n + ' could not be fetched yet', said + '. It is asked again when Home is next opened.');
    if (!rec.at) {
      var b = feedBlank(base, 'notset', 'The ' + n + ' is not set up yet', said + '. Its guide: Setting up: the news and weather.');
      b.blank.action = feedDoorHtml('guide');
      return b;
    }
    return feedBlank(base, 'offline', 'The ' + n + ' could not be fetched', said + '. Refresh to ask again.');
  }
  if (old) return feedBlank(base, 'offline', 'The ' + n + ' on this device is too old', 'It comes back when Home is opened online.');
  return feedBlank(base, 'loading', 'The ' + n + ' comes when Home opens', '');
}
/* A feed switched off, with no address, or (the weather) with no place: what to set, and its door. */
function feedNotSet(base, kind) {
  var c = feedCfg(), b = null;
  if (!c.on) b = feedBlank(base, 'notset', 'News and weather are switched off', 'Settings → Connections → News and weather.');
  else if (!c.url) b = feedBlank(base, 'notset', 'News and weather are not set up yet', 'Settings → Connections → News and weather, and its guide.');
  else if (kind === 'weather' && c.lat == null) b = feedBlank(base, 'notset', 'Set the plant’s place', 'Settings → Connections → News and weather, or the Office QR’s place.');
  if (b) b.blank.action = feedDoorHtml(!c.url ? 'guide' : 'settings');
  return b;
}
/* A blank state's door taken: Settings shut first where it is open (asking about a section not saved), a dialog holding typed work
   asking first, then Settings on its section or the guide. */
async function feedGo(to) {
  if (document.getElementById('settingsScrim')) { await closeSettings(); if (document.getElementById('settingsScrim')) return; }
  if (dialogsTypedAsk(function() { feedGo(to); })) return;
  closeOverlay();
  if (to === 'settings') openSettings('feeds'); else if (typeof kbOpenArticle === 'function') kbOpenArticle('app-feeds');
}
/* The age of a feed's copy: the Worker's own time where it is not ahead of this clock, else when it landed here. `stale` the Worker
   said its upstream failed; `old` it landed over 30 minutes ago. null with no copy. */
function feedAge(kind) {
  var rec = kind === 'weather' ? feedWeatherRec() : feedNewsRec();
  if (!rec) return null;
  var now = Date.now(), t = Date.parse((rec.data && rec.data.at) || '');
  var at = isFinite(t) && t <= now ? Math.min(t, rec.at || t) : rec.at || now;
  var ago = typeof ghRelTime === 'function' ? ghRelTime(at) : '';
  return { at: at, ms: Math.max(0, now - at), ago: ago, text: 'from ' + ago, stale: !!(rec.data && rec.data.stale), old: !rec.at || now - rec.at >= FEED_FRESH_MS };
}
/* What a widget says beside a copy it shows: its age, the Worker's last copy (stale), over 30 minutes (old), no signal (offline),
   an ask on its way (busy), and why the last ask failed where it did (`failed`, '' when it landed). */
function feedFlags(base, kind) {
  var a = feedAge(kind), rec = feedStoreRec(kind);
  return Object.assign(base, { age: a, ago: a ? a.text : '', stale: !!(a && a.stale), old: !!(a && a.old), offline: !feedOnline(), busy: !!_feedBusy[kind],
    failed: rec && rec.why ? feedWhyText(rec.why, rec.status, rec.failVia, kind) : '' });
}

/* ---------- The news ---------- */
function feedWordRe(w) { return new RegExp('(^|[^A-Za-z0-9])' + String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^A-Za-z0-9])', 'i'); }
function feedShortDay(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return isFinite(d.getTime()) ? d.getDate() + ' ' + MKT_MON[d.getMonth()] : '';
}
/* Every headline of a copy, once (a title in two topics carries both), newest first, each with the model words it names. */
function feedNewsItems(data) {
  var by = {}, out = [], models = mktModelsSent();
  FEED_TOPICS.forEach(function(t) {
    var tp = data && data.topics && data.topics[t[0]];
    ((tp && tp.items) || []).forEach(function(it) {
      var k = it.title.toLowerCase();
      if (by[k]) { if (by[k].topics.indexOf(t[0]) < 0) by[k].topics.push(t[0]); return; }
      by[k] = { title: it.title, url: it.url, source: it.source, at: it.at, lang: it.lang, topics: [t[0]], day: it.at ? isoOf(new Date(it.at)) : '',
        when: feedShortDay(it.at), models: models.filter(function(w) { return feedWordRe(w).test(it.title); }) };
      out.push(by[k]);
    });
  });
  return out.sort(function(a, b) { return String(b.at).localeCompare(String(a.at)); });
}
/* The news, for a widget or the Tata dialog. opts: topic (one of FEED_TOPICS' ids), model (a model word: only the headlines naming
   it), n (how many, 5). Returns {state, blank, items: [{title, url, source, at, day, when, lang, topics, models}], total,
   topics: [{id, label, n}], models: [{word, n}], credit, age, ago, stale, old, offline, busy}. Titles are the feed's text: escape
   them (feedNewsItemHtml does). */
function feedNews(opts) {
  opts = opts || {};
  var base = { kind: 'news', credit: FEED_CREDIT.news, items: [], total: 0, topics: [], models: [] };
  var ns = feedNotSet(base, 'news');
  if (ns) return ns;
  var rec = feedNewsRec();
  if (!rec) return feedNoCopy(base, 'news');
  var all = feedNewsItems(rec.data);
  base.topics = FEED_TOPICS.map(function(t) { return { id: t[0], label: t[1], n: all.filter(function(i) { return i.topics.indexOf(t[0]) >= 0; }).length }; });
  base.models = mktModelsSent().map(function(w) { return { word: w, n: all.filter(function(i) { return i.models.indexOf(w) >= 0; }).length }; });
  var list = all.filter(function(i) {
    return (!opts.topic || i.topics.indexOf(opts.topic) >= 0) && (!opts.model || feedWordRe(opts.model).test(i.title));
  });
  feedFlags(base, 'news');
  if (!list.length) {
    return feedBlank(base, 'empty', opts.model ? 'No headline names ' + opts.model + ' in the last 14 days' : 'No headlines in the last 14 days',
      base.offline ? 'This is the copy ' + base.ago + '.' : '');
  }
  base.state = 'ok';
  base.total = list.length;
  base.items = list.slice(0, opts.n > 0 ? opts.n : 5);
  return base;
}
/* A headline as a row: the whole row its link out (escaped title, http(s) only, a new tab, no opener, no referrer). */
function feedNewsItemHtml(it) {
  if (!it || !it.title) return '';
  var url = feedSafeUrl(it.url), meta = [it.source, it.when].filter(Boolean).join(' · ');
  var inner = '<span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(it.title) + '</span>' +
    (meta ? '<span class="inv-row-meta">' + escHtml(meta) + '</span>' : '') + '</span>';
  if (!url) return '<div class="inv-row inv-row-2" data-feed-item>' + inner + '</div>';
  return '<a class="inv-row inv-row-2 inv-mkt-news" data-feed-item href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer" title="' + escHtml(it.title) + '">' +
    inner + '<span class="inv-row-end">' + iconSvg('external') + '</span></a>';
}

/* ---------- The weather ---------- */
/* A MET Norway symbol as an icon of the set and a word (the day and night forms read alike). The set has no plain cloud or moon:
   a cloudy sky and a clear night borrow the sky's nearest, and the word says which. */
function feedWxOf(sym) {
  var s = String(sym || '').replace(/_(day|night|polartwilight)$/, '');
  if (/thunder/.test(s)) return { icon: 'storm', word: 'Thunder', rank: 4 };
  if (/snow/.test(s)) return { icon: 'rain', word: 'Snow', rank: 3 };
  if (/sleet/.test(s)) return { icon: 'rain', word: 'Sleet', rank: 3 };
  if (/rain/.test(s)) return { icon: 'rain', word: /heavy/.test(s) ? 'Heavy rain' : /light/.test(s) ? 'Light rain' : /showers/.test(s) ? 'Showers' : 'Rain', rank: 3 };
  if (s === 'fog') return { icon: 'fair', word: 'Fog', rank: 2 };
  if (s === 'cloudy') return { icon: 'fair', word: 'Cloudy', rank: 2 };
  if (s === 'partlycloudy') return { icon: 'fair', word: 'Partly cloudy', rank: 1 };
  if (s === 'fair') return { icon: 'fair', word: 'Fair', rank: 1 };
  if (s === 'clearsky') return { icon: 'today', word: 'Clear', rank: 0 };
  return { icon: 'fair', word: '', rank: -1 };
}
/* An hour of the day as the app writes times: 4 PM, 12 PM, 12 AM. */
function feedHourText(h) { h = ((h % 24) + 24) % 24; return (h % 12 || 12) + ' ' + (h < 12 ? 'AM' : 'PM'); }
/* A window from one hour to another: thunder 4–6 PM, rain 11 AM–1 PM. */
function feedWindowText(kind, from, to) {
  var a = feedHourText(from), b = feedHourText(to);
  var same = (from % 24 < 12) === (to % 24 < 12) && to % 24 !== 0;
  return kind + ' ' + (same ? a.replace(/ (AM|PM)$/, '') : a) + '–' + b;
}
/* An hour of the forecast, on this device's clock (the plant's, a phone in India). */
function feedHourRow(h) {
  var d = new Date(h.t), wx = feedWxOf(h.symbol);
  return { t: h.t, ms: d.getTime(), iso: isoOf(d), h: d.getHours(), time: feedHourText(d.getHours()), temp: h.temp, tempText: Math.round(h.temp) + '°',
    symbol: h.symbol, icon: wx.icon, word: wx.word, rain: h.rain, thunder: wx.rank === 4, wet: wx.rank >= 3 || h.rain > 0 };
}
/* The runs of hours with thunder, else with rain: [{kind, from, to (the hour after the last), say}]. */
function feedWetWindows(hours) {
  var pick = function(test, kind) {
    var out = [], run = null;
    hours.forEach(function(h) {
      if (test(h)) {
        if (run && h.ms - run.lastMs <= 3600000) { run.to = h.h + 1; run.lastMs = h.ms; }
        else { run = { kind: kind, from: h.h, to: h.h + 1, lastMs: h.ms }; out.push(run); }
      } else run = null;
    });
    return out.map(function(r) { return { kind: r.kind, from: r.from, to: r.to, say: feedWindowText(r.kind, r.from, r.to) }; });
  };
  var th = pick(function(h) { return h.thunder; }, 'thunder');
  return th.length ? th : pick(function(h) { return h.wet; }, 'rain');
}
/* The weather at the plant: {state, blank, now: {t, time, temp, tempText, symbol, icon, word, rain, thunder}, today: {date, tMax, tMin,
   rain, thunder, symbol, icon, word, window (the first of `windows` still to come: {kind, from, to, say}), windows}, hours (the next
   12, each as `now`), place: {lat, lon, name, from}, credit, age, ago, stale, old, offline, busy}. Times are this device's clock. */
function feedWeather() {
  var c = feedCfg(), base = { kind: 'weather', credit: FEED_CREDIT.weather, place: { lat: c.lat, lon: c.lon, name: c.place, from: c.placeFrom }, now: null, today: null, hours: [] };
  var ns = feedNotSet(base, 'weather');
  if (ns) return ns;
  var rec = feedWeatherRec(), now = Date.now();
  var hours = rec ? rec.data.hours.map(feedHourRow).filter(function(h) { return isFinite(h.ms); }).sort(function(a, b) { return a.ms - b.ms; }) : [];
  var cur = hours.find(function(h) { return h.ms <= now && now < h.ms + 3600000; }) || hours.find(function(h) { return h.ms > now && h.ms - now < 3 * 3600000; });
  if (!rec || !cur) return feedNoCopy(base, 'weather', !!rec);
  var today = localDateStr(), d = rec.data.days.find(function(x) { return x.date === today; }) || null;
  var ahead = hours.filter(function(h) { return h.iso === today && h.ms + 3600000 > now; });
  var wins = feedWetWindows(ahead), wx = d ? feedWxOf(d.symbol) : null;
  base.now = cur;
  base.hours = hours.filter(function(h) { return h.ms + 3600000 > now; }).slice(0, 12);
  base.today = { date: today, tMax: d ? d.tMax : null, tMin: d ? d.tMin : null, rain: d ? d.rain : null, thunder: d ? d.thunder : ahead.some(function(h) { return h.thunder; }),
    symbol: d ? d.symbol : '', icon: wx ? wx.icon : cur.icon, word: wx ? wx.word : '', window: wins[0] || null, windows: wins };
  feedFlags(base, 'weather');
  base.state = 'ok';
  return base;
}
/* For `risk` (§7d): today's hours the forecast has thunder in, past ones the copy still holds included, on this device's clock.
   {state, blank, date, hours: [16, 17], windows, say ('thunder 4–6 PM', '' with none), age, ago, offline}. */
function feedThunderToday() {
  var w = feedWeather();
  if (w.state !== 'ok') return { state: w.state, blank: w.blank, date: localDateStr(), hours: [], windows: [], say: '' };
  var today = localDateStr(), rec = feedWeatherRec();
  var hours = rec.data.hours.map(feedHourRow).filter(function(h) { return h.iso === today; }).sort(function(a, b) { return a.ms - b.ms; });
  var th = hours.filter(function(h) { return h.thunder; }), wins = feedWetWindows(th.length ? hours : []).filter(function(x) { return x.kind === 'thunder'; });
  return { state: 'ok', date: today, hours: th.map(function(h) { return h.h; }), windows: wins, say: wins.length ? wins[0].say : '', age: w.age, ago: w.ago, offline: w.offline };
}
/* For the day card (§8b): the weather now as {icon, temp, say, word, html}, or null when there is none to show (no placeholder). */
function feedDayViz() {
  var w = feedWeather();
  if (w.state !== 'ok' || !w.now) return null;
  var say = w.today && w.today.window ? w.today.window.say : '';
  var label = [w.now.word || '', w.now.tempText, say, w.ago].filter(Boolean).join(', ');
  return { icon: w.now.icon, temp: w.now.tempText, say: say, word: w.now.word, label: label,
    html: '<span class="inv-wx-now" data-wx-now title="' + escHtml(label) + '" aria-label="' + escHtml('Weather: ' + label) + '">' + iconSvg(w.now.icon, 'inv-wx-ico') +
      '<span class="inv-wx-temp">' + escHtml(w.now.tempText) + '</span>' + (say ? '<span class="inv-wx-say">' + escHtml(say) + '</span>' : '') + '</span>' };
}
function feedWeatherVizHtml() { var v = feedDayViz(); return v ? v.html : ''; }
/* For `weather` (§9d): once 30 days are kept, the plant's cuts set beside the forecast the book kept for their days, two counts side
   by side and never a cause (the book keeps a day's forecast, not the hour a cut began):
   - of the cut days in the last 30 with a forecast kept, how many had rain or thunder forecast (`wetCutDays` of `cutDays`);
   - of the last 10 cuts on days with a forecast kept, how many came on a day thunder was forecast (`stormCuts` of `cuts`).
   {state ('early' under 30 days kept), blank, kept, need, since, cutDays, wetCutDays, cuts, stormCuts, say}. */
function feedWeatherCutDays() {
  var w = mktRead().weather, days = Object.keys(w).filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && w[d] && typeof w[d] === 'object'; }).sort();
  var base = { kept: days.length, need: MKT_WEATHER_EARLY, since: days[0] || '', cutDays: 0, wetCutDays: 0, cuts: 0, stormCuts: 0, say: '' };
  if (days.length < MKT_WEATHER_EARLY) return feedBlank(base, 'early', 'Not enough yet: ' + days.length + ' of ' + MKT_WEATHER_EARLY + ' days kept', 'A day is kept each time the weather is fetched.');
  var rows = [];
  try { rows = typeof dvRows === 'function' ? dvRows('power_cuts') : []; } catch (e) { rows = []; /* no cuts read: none counted */ }
  var kept = rows.filter(function(r) { return r && r.date && w[r.date] && typeof w[r.date] === 'object'; });
  var from = isoAddDays(localDateStr(), -29), seen = {};
  kept.forEach(function(r) {
    if (r.date < from || seen[r.date]) return;
    seen[r.date] = 1;
    base.cutDays++;
    if (w[r.date].thunder === true || w[r.date].rain > 0) base.wetCutDays++;
  });
  // The last ten, newest first: by the day, then the minute the cut began.
  var at = function(r) { return r.date + ' ' + String(r.from || ''); };
  var last = kept.slice().sort(function(a, b) { return at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0; }).slice(0, 10);
  base.cuts = last.length;
  base.stormCuts = last.filter(function(r) { return w[r.date].thunder === true; }).length;
  base.state = 'ok';
  base.say = 'Of ' + base.cutDays + ' cut day' + (base.cutDays === 1 ? '' : 's') + ' in the last 30, ' + base.wetCutDays + ' had rain forecast that day';
  return base;
}

/* ---------- The book: S.market ---------- */
function mktData() {
  if (!S.market || typeof S.market !== 'object' || Array.isArray(S.market)) S.market = {};
  ['tata', 'calendar', 'weather'].forEach(function(k) { if (!S.market[k] || typeof S.market[k] !== 'object' || Array.isArray(S.market[k])) S.market[k] = {}; });
  if (!Array.isArray(S.market.models)) S.market.models = getDefaultState().market.models.slice();
  return S.market;
}
/* Read without writing: drawing never changes the book. */
function mktRead() {
  var m = S && S.market && typeof S.market === 'object' ? S.market : {};
  var obj = function(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  return { tata: obj(m.tata), calendar: obj(m.calendar), weather: obj(m.weather), models: Array.isArray(m.models) ? m.models : [] };
}
/* Who typed it, as a record says it (the change log names the ID itself). */
function mktBy() { var u = typeof grdUser === 'function' ? grdUser() : null; return u && u.name ? String(u.name) : ''; }
function mktCanEdit() { return typeof grdCan !== 'function' || grdCan('settings'); }

/* ---------- Months ---------- */
function mktMonthOk(m) { return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
function mktMonthAdd(m, n) {
  var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n;
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
  return y + '-' + String(mo + 1).padStart(2, '0');
}
function mktMonthName(m) { return mktMonthOk(m) ? MKT_MONTHS[+m.slice(5, 7) - 1] : String(m || ''); }
function mktMonthLabel(m) { return mktMonthOk(m) ? mktMonthName(m) + ' ' + m.slice(0, 4) : String(m || ''); }
function mktMonthShort(m) { return mktMonthOk(m) ? MKT_MON[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) : String(m || ''); }

/* ---------- Tata's months ---------- */
function mktUnits(v) { return typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? +v.trim() : null; }
function mktFigOf(r, key) { var f = r && r[key]; return f && typeof f === 'object' ? { now: mktUnits(f.now), ly: mktUnits(f.ly) } : { now: mktUnits(f), ly: null }; }
/* A month counts as typed with one figure in it. */
function mktTyped(r) {
  return !!(r && typeof r === 'object' && MKT_FIGS.some(function(f) { var x = mktFigOf(r, f.key); return x.now != null || x.ly != null; }));
}
function mktTypedMonths() { var t = mktRead().tata; return Object.keys(t).filter(function(m) { return mktMonthOk(m) && mktTyped(t[m]); }).sort(); }
/* A figure with its change on last year: {key, label, now, ly, chg, pct, dir ('up' | 'down' | 'flat'), tone, say ('+7.5% on last year')}.
   Up is ok (more trucks built is more work for the clients who plate for them), down is a warning, flat plain. */
function mktFig(r, f) {
  var x = mktFigOf(r, f.key), chg = x.now != null && x.ly != null ? x.now - x.ly : null;
  var pct = chg != null && x.ly > 0 ? Math.round(chg / x.ly * 1000) / 10 : null;
  var dir = pct == null ? null : Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down';
  return { key: f.key, label: f.label, now: x.now, ly: x.ly, chg: chg, pct: pct, dir: dir, tone: dir === 'up' ? 'ok' : dir === 'down' ? 'warning' : 'neutral',
    say: pct == null ? '' : (pct > 0 ? '+' : pct < 0 ? '−' : '') + Math.abs(pct).toFixed(1) + '% on last year' };
}
function mktFmt(n) { return n == null ? '' : Number(n).toLocaleString('en-IN'); }
/* The month Tata's figures are due for: from the 2nd, the month before, until it is typed; else null. */
function mktTataDue() {
  var today = localDateStr();
  if (+today.slice(8, 10) < 2) return null;
  var prev = mktMonthAdd(today.slice(0, 7), -1);
  return mktTyped(mktRead().tata[prev]) ? null : prev;
}
/* For `tata` (§7d): the latest month typed. {state ('empty' with none), blank, month, label, short, released, url, note, by, at,
   figs: [mktFig for all CVs, CVs in India, CV exports, heavy trucks], due (the month asked for, or null)}. */
function mktTataLatest() {
  var months = mktTypedMonths(), due = mktTataDue();
  if (!months.length) return { state: 'empty', due: due, figs: [], blank: { kind: 'empty', title: 'No month typed yet', body: 'Type a month’s figures from Tata Motors’ release.' } };
  var m = months[months.length - 1], r = mktRead().tata[m];
  return { state: 'ok', month: m, label: mktMonthLabel(m), short: mktMonthShort(m), released: typeof r.released === 'string' ? r.released : '', url: feedSafeUrl(r.url),
    note: typeof r.note === 'string' ? r.note : '', by: typeof r.by === 'string' ? r.by : '', at: r.at || null, due: due,
    figs: MKT_FIGS.map(function(f) { return mktFig(r, f); }) };
}
/* For `tata` Large: one figure month by month, this year against last. {state, field, label, from, to, rows: [{month, label ('Sep'),
   now, ly}]}, the n months (13) to the latest typed; a month not typed is null on both sides, never 0. */
function mktTataMonths(field, n) {
  var f = MKT_FIGS.find(function(x) { return x.key === field; }) || MKT_FIGS[0], months = mktTypedMonths();
  if (!months.length) return { state: 'empty', field: f.key, label: f.label, rows: [], blank: { kind: 'empty', title: 'No month typed yet', body: 'Type a month’s figures from Tata Motors’ release.' } };
  var to = months[months.length - 1], k = n > 0 ? Math.min(n, 36) : 13, t = mktRead().tata, rows = [];
  for (var i = k - 1; i >= 0; i--) {
    var m = mktMonthAdd(to, -i), x = mktTyped(t[m]) ? mktFigOf(t[m], f.key) : { now: null, ly: null };
    rows.push({ month: m, label: MKT_MON[+m.slice(5, 7) - 1], now: x.now, ly: x.ly });
  }
  return { state: 'ok', field: f.key, label: f.label, from: rows[0].month, to: to, rows: rows };
}

/* ---------- The plant's calendar ---------- */
function mktCalEntry(e) { return e && typeof e === 'object' && (e.state === 'works' || e.state === 'shut') ? e : null; }
/* For the plant's week (§9c): today and the next six days, each an entry's state, else a weekday works and a Sunday usually shut
   (both plain). {state: 'ok', from, days: [{date, dow ('Tue'), d (20), mon ('Oct'), state, usual, word ('works' | 'shut' |
   'usually shut'), tone (an entry: shut warning, works info; else neutral), why, src, url}], entries (how many days carry one)}. */
function mktPlantWeek(from) {
  var start = typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : localDateStr(), cal = mktRead().calendar, days = [];
  for (var i = 0; i < 7; i++) {
    var iso = isoAddDays(start, i), dt = new Date(iso + 'T00:00:00'), dow = dt.getDay(), e = mktCalEntry(cal[iso]);
    days.push({ date: iso, dow: MKT_DOW[dow], d: dt.getDate(), mon: MKT_MON[dt.getMonth()], state: e ? e.state : dow === 0 ? 'shut' : 'works', usual: !e,
      word: e ? e.state : dow === 0 ? 'usually shut' : 'works', tone: !e ? 'neutral' : e.state === 'shut' ? 'warning' : 'info',
      why: e && typeof e.why === 'string' ? e.why : '', src: e && e.src ? String(e.src) : '', url: e ? feedSafeUrl(e.url) : '' });
  }
  return { state: 'ok', from: start, days: days, entries: days.filter(function(d) { return !d.usual; }).length };
}

/* ---------- Offers read from the headlines (§9c): never applied ---------- */
var MKT_MONTH_TOKEN = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
function mktMonthIndex(tok) { var t = String(tok || '').toLowerCase().slice(0, 3); return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(t); }
/* The months a title names: [{mi (0–11), year (or null), at (its place in the title)}]. "May" counts only where it reads as the month
   (after in, for, of, during or since, or before a year or "sales"), never the verb. */
function mktTitleMonths(title) {
  var re = new RegExp('\\b' + MKT_MONTH_TOKEN + '\\b\\.?(?:\\s*,?\\s*[\'’]?(\\d{4}|\\d{2})\\b)?', 'gi'), out = [], m;
  while ((m = re.exec(title))) {
    var tok = m[1], low = tok.toLowerCase();
    if (low === 'may') {
      var before = title.slice(Math.max(0, m.index - 8), m.index).toLowerCase(), after = title.slice(m.index + m[0].length, m.index + m[0].length + 8).toLowerCase();
      if (!/\b(in|for|of|during|since)\s+$/.test(before) && !m[2] && !/^\s*(cv |sales)/.test(after)) continue;
    } else if (tok.length <= 4 && tok.charAt(0) !== tok.charAt(0).toUpperCase()) continue;   // "mar", "sept" written small are words
    var y = m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : null;
    out.push({ mi: mktMonthIndex(tok), year: y, at: m.index });
  }
  return out;
}
/* The figure a headline gives for a month, read from "N units" beside CV or commercial vehicle (or exports, or heavy trucks):
   [{field, which ('now' | 'ly'), value, …the headline}]. A passenger car, a PV or an EV headline gives none. */
function mktHeadFigures(it, month) {
  var title = it.title, out = [];
  if (/passenger|\bpvs?\b|\bcars?\b|\bevs?\b|electric vehicle/i.test(title)) return out;
  var months = mktTitleMonths(title), mi = +month.slice(5, 7) - 1, yr = +month.slice(0, 4);
  var named = months.filter(function(x) { return x.mi === mi && (x.year == null || x.year === yr); });
  if (!named.length || months.some(function(x) { return x.mi === mi && x.year != null && x.year !== yr; }) && !months.some(function(x) { return x.mi === mi && x.year === yr; })) return out;
  // A headline older than the month, or long after it, is about another year's.
  if (it.at) {
    var d = it.at.slice(0, 7);
    if (d < month || d > mktMonthAdd(month, 2)) return out;
  }
  var cv = /\bcvs?\b|commercial vehicles?|\bm\s*&\s*hcvs?\b|\bm?hcvs?\b|\btrucks?\b/i.test(title);
  // A figure counts with its unit beside it: units, vehicles, nos, CVs or commercial vehicles.
  var re = /(\d{1,3}(?:,\d{2,3})+|\d{3,7})\s*(?:units|vehicles|nos|cvs?|commercial vehicles?)\b/gi, m, last = 0, seen = {};
  while ((m = re.exec(title))) {
    var seg = title.slice(last, m.index), near = title.slice(Math.max(0, m.index - 24), m.index), value = +m[1].replace(/,/g, '');
    last = m.index + m[0].length;
    if (!(value > 0) || value > MKT_FIG_MAX) continue;
    var field = /export/i.test(seg) ? 'cvExport' : /\bm\s*&\s*hcvs?\b|\bm?hcvs?\b|heavy (?:commercial vehicles?|trucks?)/i.test(seg) ? 'hcv'
      : /domestic/i.test(seg) && cv ? 'cvDomestic' : cv ? 'cvTotal' : '';
    if (!field) continue;
    var which = /\b(from|against|compared (?:with|to)|vs\.?|versus|last year|year[- ]ago)\s*$/i.test(near.trim() + ' ') || /\b(from|against|vs\.?|versus)\s+$/i.test(near) ? 'ly' : 'now';
    if (seen[field + which]) continue;
    seen[field + which] = 1;
    var f = MKT_FIGS.find(function(x) { return x.key === field; });
    out.push({ field: field, which: which, value: value, month: month, title: it.title, url: it.url, source: it.source, at: it.at, when: it.when,
      said: 'A headline says ' + mktFmt(value) + ' ' + f.say + ' in ' + mktMonthName(month) + (which === 'ly' ? ' a year before' : '') });
  }
  return out;
}
/* The days a headline names the plant shut or working on: {state, dates: ['2026-10-20', …]} or null. The plant is Jamshedpur's (the
   plant topic, or the title naming it); "block closure", "shut", "closed" or "no work" is shut, "works on Sunday" or "working on a
   holiday" works; a title saying both, or neither, offers nothing, and so does one whose weekday disagrees with its date. */
var MKT_NUM_WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
function mktHeadDays(it) {
  var title = it.title;
  if (!(it.topics && it.topics.indexOf('tata-plant') >= 0) && !/jamshedpur/i.test(title)) return null;
  var shut = /\bblock[- ]?closures?\b|\bshut(?:down|s)?\b|\bclos(?:ed|ure|es)\b|\bno[- ]work\b|\bnon[- ]working\b|\bsuspend(?:s|ed)? (?:work|production)\b/i.test(title);
  var works = /\bwork(?:s|ing)?\s+(?:on\s+)?(?:a\s+)?(?:sundays?|holidays?)\b|\b(?:sunday|holiday)\s+working\b|\bproduction\s+on\s+(?:a\s+)?sundays?\b/i.test(title);
  if (shut === works) return null;
  // A title that says the plant is NOT shut, or opens again, offers nothing: "no closure", "works as usual", "resumes".
  if (/\bno (?:block[- ]?)?(?:closure|shutdown)s?\b|\bnot (?:be )?(?:shut|closed)\b|\bwithout (?:a )?(?:closure|shutdown)\b|\bas usual\b|\bresum(?:e|es|ed|ing)\b|\breopen/i.test(title)) return null;
  var dates = [], at = it.at ? new Date(it.at) : new Date(), base = isFinite(at.getTime()) ? at : new Date();
  var place = function(mi, day, year) {
    if (!(day >= 1 && day <= 31) || mi < 0) return;
    var cands = year ? [year] : [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1];
    var best = null;
    cands.forEach(function(y) {
      var d = new Date(y, mi, day);
      if (d.getMonth() !== mi) return;
      var gap = (d.getTime() - base.getTime()) / 86400000;
      if (year || (gap >= -45 && gap <= 200 && (!best || Math.abs(gap) < Math.abs(best.gap)))) best = { iso: isoOf(d), gap: gap };
    });
    if (best && dates.indexOf(best.iso) < 0) dates.push(best.iso);
  };
  var dayList = function(s) {
    // An ordinal's letters go only after its digits: "and" ends in "nd" too.
    var out = [], parts = s.replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1').split(/\s*(?:,|&|\band\b)\s*/i);
    parts.forEach(function(p) {
      var r = /^(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})$/i.exec(p.trim());
      if (r) { for (var d = +r[1]; d <= +r[2] && d - +r[1] < 10; d++) out.push(d); return; }
      if (/^\d{1,2}$/.test(p.trim())) out.push(+p.trim());
    });
    return out;
  };
  var DAYS = '(\\d{1,2}(?:st|nd|rd|th)?(?:\\s*(?:,|&|and|to|-|–)\\s*\\d{1,2}(?:st|nd|rd|th)?)*)';
  var reA = new RegExp('\\b' + MKT_MONTH_TOKEN + '\\.?\\s+' + DAYS + '(?:\\s*,?\\s*(\\d{4}))?', 'gi');
  var reB = new RegExp('\\b' + DAYS + '\\s+(?:of\\s+)?' + MKT_MONTH_TOKEN + '\\b\\.?(?:\\s*,?\\s*(\\d{4}))?', 'gi'), m;
  while ((m = reA.exec(title))) dayList(m[2]).forEach(function(d) { place(mktMonthIndex(m[1]), d, m[3] ? +m[3] : null); });
  while ((m = reB.exec(title))) dayList(m[1]).forEach(function(d) { place(mktMonthIndex(m[2]), d, m[3] ? +m[3] : null); });
  // "for two days from October 20": the days after the first.
  var span = /\bfor\s+(\d|one|two|three|four|five|six|seven)\s+days?\b/i.exec(title);
  if (span && dates.length === 1) { var n = MKT_NUM_WORD[span[1].toLowerCase()] || +span[1]; for (var i = 1; i < n && i < 7; i++) dates.push(isoAddDays(dates[0], i)); }
  if (!dates.length) return null;
  dates.sort();
  var wd = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(title);
  if (wd && dates.length === 1 && ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(wd[1].toLowerCase()) !== new Date(dates[0] + 'T00:00:00').getDay()) return null;
  return { state: shut ? 'shut' : 'works', dates: dates };
}
/* "Tue 20 and Wed 21 Oct", "Fri 31 Oct and Sat 1 Nov". */
function mktDaysText(dates) {
  var parts = dates.map(function(iso, i) {
    var d = new Date(iso + 'T00:00:00'), next = dates[i + 1] ? new Date(dates[i + 1] + 'T00:00:00') : null;
    return MKT_DOW[d.getDay()] + ' ' + d.getDate() + (!next || next.getMonth() !== d.getMonth() ? ' ' + MKT_MON[d.getMonth()] : '');
  });
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
}
/* What the headlines offer, never applied (§9c): `figures` a month's (the month given, else the one due, else the latest typed),
   [{field, which, value, said, title, url, source, at, when}]; `calendar` the plant's days from today on that the calendar does not
   already say, [{state, dates, head ('Add to the calendar: Tue 20 and Wed 21 Oct shut'), said (the head and '(source, 14 Oct)'), title, url,
   source, at, when}]. */
function mktOffers(month) {
  var rec = feedNewsRec(), out = { figures: [], calendar: [] };
  if (!rec) return out;
  var items = feedNewsItems(rec.data), m = mktMonthOk(month) ? month : mktTataDue() || mktMonthAdd(localDateStr().slice(0, 7), -1);
  var seenF = {};
  items.forEach(function(it) {
    mktHeadFigures(it, m).forEach(function(o) { var k = o.field + o.which + o.value; if (!seenF[k]) { seenF[k] = 1; out.figures.push(o); } });
  });
  var today = localDateStr(), cal = mktRead().calendar, seenC = {};
  items.forEach(function(it) {
    var r = mktHeadDays(it);
    if (!r) return;
    var dates = r.dates.filter(function(d) { var e = mktCalEntry(cal[d]); return d >= today && isoDaysBetween(today, d) <= 120 && !(e && e.state === r.state); });
    var k = r.state + dates.join(',');
    if (!dates.length || seenC[k]) return;
    seenC[k] = 1;
    var head = 'Add to the calendar: ' + mktDaysText(dates) + ' ' + r.state;
    out.calendar.push({ state: r.state, dates: dates, title: it.title, url: it.url, source: it.source, at: it.at, when: it.when, head: head,
      said: head + ' (' + [it.source, it.when].filter(Boolean).join(', ') + ')' });
  });
  return out;
}

/* ---------- The weather days (§9d): written as an answer lands, quiet ---------- */
/* What a day was forecast, as the widest of the day's forecasts: the highest high, the lowest low, the most rain, thunder if any said
   so, the most severe sky. A forecast fetched at 6 PM covers only the hours left, so the last one alone would have lost the
   afternoon's storm. */
function mktWeatherJoin(o, d) {
  o = o && typeof o === 'object' ? o : {};
  var hi = function(a, b) { return a == null ? (b == null ? null : b) : b == null ? a : Math.max(a, b); };
  var lo = function(a, b) { return a == null ? (b == null ? null : b) : b == null ? a : Math.min(a, b); };
  var sym = feedWxOf(d.symbol).rank >= feedWxOf(o.symbol).rank ? d.symbol || o.symbol || '' : o.symbol || '';
  return { tMax: hi(o.tMax, d.tMax), tMin: lo(o.tMin, d.tMin), rain: hi(o.rain, d.rain), thunder: !!(o.thunder || d.thunder), symbol: sym, at: o.at || null };
}
/* Today's forecast written into the book from the copy for this place, and the days past 400 dropped; saved only when a day moved.
   Not while the book is a stand-in, nor while the guard holds the screen with nobody signed in (the next answer writes it). The
   save is quiet: written to the device (persistState) without the change log's pass, which never compares the store, and without
   arming the GitHub push, so a forecast refetched every half hour is not a push each time: the next save of a change carries it. */
function mktWeatherKeep() {
  if (!S || (typeof bookStandIn === 'function' && bookStandIn())) return false;
  if (typeof grdNobody === 'function' && grdNobody()) return false;
  var rec = feedWeatherRec(), today = localDateStr();
  var d = rec ? rec.data.days.find(function(x) { return x.date === today; }) : null;
  var w = mktData().weather, changed = false, cut = isoAddDays(today, -MKT_WEATHER_KEEP);
  Object.keys(w).forEach(function(k) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < cut) { delete w[k]; changed = true; } });
  if (d) {
    var old = w[today], next = mktWeatherJoin(old, d);
    if (!old || ['tMax', 'tMin', 'rain', 'thunder', 'symbol'].some(function(k) { return old[k] !== next[k]; })) { next.at = Date.now(); w[today] = next; changed = true; }
  }
  if (changed) persistState();
  return changed;
}

/* ---------- The To-do: a month's figures to type (the owner's) ---------- */
TODO_RULES.push(['mktTata', 'Tata Motors: a month’s figures to type']);
TODO_CHECK_DEFAULTS.mktTata = true;
TODO_RULE_NEED.mktTata = 'owner';
TODO_RULE_FNS.mktTata = function() {
  var due = mktTataDue();
  if (!due) return [];
  var months = mktTypedMonths(), last = months.length ? months[months.length - 1] : '', off = mktOffers(due).figures;
  var facts = [['Month', mktMonthLabel(due)], ['Last typed', last ? mktMonthLabel(last) : 'none yet']];
  if (off.length) facts.push(['A headline says', off[0].said.replace(/^A headline says /, '')]);
  return [{ key: 'mktTata:' + due, rule: 'mktTata', tone: 'info', month: due, title: 'Type ' + mktMonthName(due) + '’s Tata figures',
    sub: 'From Tata Motors’ release: all CVs, in India, exports, heavy trucks', why: 'Tata Motors · the month’s sales', facts: facts,
    clears: 'Clears itself when ' + mktMonthLabel(due) + '’s figures are saved.', go: { kind: 'mktTata', month: due }, goLabel: 'Type the figures', sig: due }];
};

/* ---------- The Tata dialog (§9c) ---------- */
/* The months the dialog offers: the month before this one and the twelve before it, then any typed earlier, newest first. */
function mktMonthChoices() {
  var prev = mktMonthAdd(localDateStr().slice(0, 7), -1), out = [];
  for (var i = 0; i < 13; i++) out.push(mktMonthAdd(prev, -i));
  mktTypedMonths().forEach(function(m) { if (out.indexOf(m) < 0 && m < prev) out.push(m); });
  return out.sort().reverse();
}
/* Opens the dialog on a month: the one given, else the one due, else the latest typed, else the month before. Anyone may read it;
   what is typed in it is the settings permission's (grdGate('settings')), as the market's setup is. */
function mktTataOpen(month) {
  var choices = mktMonthChoices();
  var m = mktMonthOk(month) ? month : mktTataDue() || mktTypedMonths().pop() || choices[0];
  _mktDlg = { month: m, model: '' };
  if (choices.indexOf(m) < 0 && m > choices[0]) _mktDlg.month = choices[0];
  dialogOpen(mktTataHtml(), { dismiss: true, replace: !!document.querySelector('[data-mkt-tata]') });
}
function mktTataHtml() {
  var can = mktCanEdit(), m = _mktDlg.month;
  return '<div class="inv-dialog" data-mkt-tata role="dialog" aria-modal="true" aria-labelledby="mktTitle">' +
    dialogHeadHtml('<span id="mktTitle">Tata Motors, Jamshedpur</span>', 'invMktClose') +
    '<div class="inv-dialog-body">' +
      (can ? '' : '<div class="inv-callout inv-callout-info inv-mb-8">Only an ID that may change Settings types these. You can read them here.</div>') +
      '<section data-mkt-part="month">' + mktMonthPartHtml() + '</section>' +
      '<section data-mkt-part="months">' + mktMonthsPartHtml() + '</section>' +
      '<section data-mkt-part="calendar">' + mktCalPartHtml() + '</section>' +
      '<section data-mkt-part="models">' + mktModelsPartHtml() + '</section>' +
      '<section data-mkt-part="news">' + mktNewsPartHtml() + '</section>' +
    '</div>' +
    '<div class="inv-dialog-foot"><button type="button" class="inv-btn inv-btn-secondary" data-action="invMktClose">Close</button>' +
      (can ? '<button type="button" class="inv-btn inv-btn-primary" data-action="invMktSave" data-month="' + escHtml(m) + '">Save ' + escHtml(mktMonthName(m)) + '</button>' : '') +
    '</div></div>';
}
function mktPartRedraw(part) {
  var el = document.querySelector('[data-mkt-tata] [data-mkt-part="' + part + '"]');
  if (!el) return;
  var fn = { month: mktMonthPartHtml, months: mktMonthsPartHtml, calendar: mktCalPartHtml, models: mktModelsPartHtml, news: mktNewsPartHtml }[part];
  keepScroll(function() { el.innerHTML = fn(); });
}
function mktFigId(key, which) { return 'mktF_' + key + '_' + which; }
function mktMonthPartHtml() {
  var m = _mktDlg.month, r = mktRead().tata[m] || {}, can = mktCanEdit(), dis = can ? '' : ' disabled', ly = mktMonthAdd(m, -12);
  var typed = mktTyped(r), choices = mktMonthChoices();
  if (choices.indexOf(m) < 0) { choices.push(m); choices.sort().reverse(); }
  var opts = choices.map(function(x) {
    return '<option value="' + x + '"' + (x === m ? ' selected' : '') + '>' + escHtml(mktMonthLabel(x) + (mktTyped(mktRead().tata[x]) ? ' · typed' : '')) + '</option>';
  }).join('');
  var num = function(key, which, aria) {
    var v = mktFigOf(r, key)[which];
    return '<input class="inv-input inv-input-num" id="' + mktFigId(key, which) + '" type="text" inputmode="numeric" autocomplete="off" aria-label="' + escHtml(aria) + '" value="' +
      (v == null ? '' : escHtml(String(v))) + '"' + dis + '>';
  };
  var figs = '<div class="inv-mkt-figs" role="group" aria-label="The month’s figures, in units">' +
    '<span class="inv-field-label">In units</span><span class="inv-field-label">' + escHtml(mktMonthShort(m)) + '</span><span class="inv-field-label">' + escHtml(mktMonthShort(ly)) + '</span>' +
    MKT_FIGS.map(function(f) {
      return '<label class="inv-mkt-fig-k" for="' + mktFigId(f.key, 'now') + '" title="' + escHtml(f.what) + '">' + escHtml(f.label) + '</label>' +
        num(f.key, 'now', f.label + ', ' + mktMonthLabel(m)) + num(f.key, 'ly', f.label + ', ' + mktMonthLabel(ly));
    }).join('') + '</div>';
  var off = mktOffers(m).figures;
  var offers = off.length ? '<div class="inv-panel inv-panel-flush inv-mb-8" data-mkt-offers><div class="inv-panel-head"><span class="inv-panel-title">From the headlines <span class="inv-panel-count">' +
    off.length + '</span></span></div>' + off.map(function(o, i) {
      return '<div class="inv-row inv-row-2 inv-row-flow" data-mkt-offer="' + i + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(o.said) + '</span>' +
        '<span class="inv-row-meta">' + mktSourceHtml(o) + '</span></span><span class="inv-row-end">' +
        (can ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktUse" data-field="' + o.field + '" data-which="' + o.which + '" data-value="' + o.value + '">Use</button>' : '') +
        '</span></div>';
    }).join('') + '<div class="inv-row"><span class="inv-note">Check each against Tata Motors’ release before you save it.</span></div></div>' : '';
  var at = typed && r.at ? 'Typed ' + formatTimestamp(r.at) + (r.by ? ' by ' + r.by : '') + '. Saving again replaces it.' : 'Not typed yet. Leave a figure blank where the release does not print it.';
  return '<div class="inv-field"><label class="inv-field-label" for="mktMonth">The month</label><select class="inv-select" id="mktMonth">' + opts + '</select>' +
      '<div class="inv-field-hint" data-mkt-typed>' + escHtml(at) + '</div></div>' + figs + offers +
    '<div class="inv-fields">' +
      '<div class="inv-field"><label class="inv-field-label" for="mktRel">Released on</label><input class="inv-input" type="date" id="mktRel" value="' + escHtml(typeof r.released === 'string' ? r.released : '') + '"' + dis + '></div>' +
      '<div class="inv-field"><label class="inv-field-label" for="mktUrl">Link to the release</label><input class="inv-input" type="url" id="mktUrl" autocomplete="off" placeholder="https://" value="' + escHtml(typeof r.url === 'string' ? r.url : '') + '"' + dis + '></div>' +
    '</div>' +
    '<div class="inv-field"><label class="inv-field-label" for="mktNote">Note</label><input class="inv-input" id="mktNote" autocomplete="off" value="' + escHtml(typeof r.note === 'string' ? r.note : '') + '"' + dis + '></div>';
}
/* A headline's source, linked to its article, and its day. */
function mktSourceHtml(o) {
  var url = feedSafeUrl(o.url), src = o.source || feedHost(url) || 'the article';
  return (url ? '<a class="inv-btn-link" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(src) + '</a>' : escHtml(src)) + (o.when ? ' · ' + escHtml(o.when) : '');
}
function mktMonthsPartHtml() {
  var months = mktTypedMonths().reverse(), t = mktRead().tata;
  if (!months.length) return '';
  var rows = months.map(function(m) {
    var f = mktFig(t[m], MKT_FIGS[0]);
    var meta = f.now != null ? mktFmt(f.now) + ' CVs' + (f.say ? ' · ' + f.say : '') : MKT_FIGS.map(function(x) { var y = mktFig(t[m], x); return y.now != null ? mktFmt(y.now) + ' ' + x.say : ''; }).filter(Boolean)[0] || '';
    return '<div class="inv-row inv-row-2"' + (m === _mktDlg.month ? ' aria-current="true"' : '') + '><button type="button" class="inv-row-main" data-action="invMktMonth" data-month="' + m + '">' +
      '<span class="inv-row-title">' + escHtml(mktMonthLabel(m)) + '</span><span class="inv-row-meta">' + escHtml(meta) + '</span></button>' +
      (f.dir ? uiRowEndHtml('', { tone: f.tone, word: f.dir }) : '') + '</div>';
  });
  return uiFoldHtml('mkt-months', '<span class="inv-panel-title">Months typed <span class="inv-panel-count">' + months.length + '</span></span>',
    uiMoreHtml('mkt-months', rows, { n: 6, noun: 'months' }), !!_isDesktop, ' data-mkt-months');
}
function mktWeekHtml(week) {
  return '<div class="inv-mkt-week" data-mkt-week>' + week.days.map(function(d) {
    var title = d.date + ': ' + (d.usual ? d.word : d.word + (d.why ? ', ' + d.why : ''));
    // A day says shut, or works where the calendar names it (a Sunday worked); a usual working day says nothing more (the canvas).
    // That a Sunday is only usually shut is its title's; the tone says a day the calendar names; a usual shut day is drawn hollow.
    var word = d.state === 'shut' || !d.usual ? '<span class="inv-mkt-day-s">' + escHtml(d.state) + '</span>' : '';
    return '<div class="inv-mkt-day" data-day="' + d.date + '"' + (d.tone !== 'neutral' ? ' data-tone="' + d.tone + '"' : '') + (d.state === 'shut' ? ' data-shut' : '') +
      ' title="' + escHtml(title) + '"><span class="inv-mkt-day-dow">' + d.dow + '</span><span class="inv-mkt-day-d">' + d.d + '</span>' + word + '</div>';
  }).join('') + '</div>';
}
var MKT_SRC_WORD = { news: 'from the news', circular: 'from Tata’s circular', owner: 'typed here' };
function mktCalPartHtml() {
  var can = mktCanEdit(), today = localDateStr(), cal = mktRead().calendar, off = mktOffers(_mktDlg.month).calendar;
  var ahead = Object.keys(cal).filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && mktCalEntry(cal[d]) && d >= today; }).sort();
  var body = '<div class="inv-panel-body">' + mktWeekHtml(mktPlantWeek(today)) + '</div>';
  if (off.length) body += off.map(function(o, i) {
    // The row says the offer; its source and day are the meta line under it, linked.
    return '<div class="inv-row inv-row-2 inv-row-flow" data-mkt-caloffer="' + i + '"><span class="inv-row-main"><span class="inv-row-title inv-row-wrap">' + escHtml(o.head) + '</span>' +
      '<span class="inv-row-meta">' + mktSourceHtml(o) + '</span></span><span class="inv-row-end">' +
      (can ? '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktCalOffer" data-state="' + o.state + '" data-dates="' + escHtml(o.dates.join(',')) + '" data-url="' + escHtml(feedSafeUrl(o.url)) + '">Add</button>' : '') +
      '</span></div>';
  }).join('');
  body += ahead.map(function(d) {
    var e = cal[d], dt = new Date(d + 'T00:00:00');
    return '<div class="inv-row inv-row-2" data-mkt-calday="' + d + '"><span class="inv-row-main"><span class="inv-row-title">' + escHtml(MKT_DOW[dt.getDay()] + ' ' + dt.getDate() + ' ' + MKT_MON[dt.getMonth()] + ' ' + e.state) + '</span>' +
      '<span class="inv-row-meta">' + escHtml([MKT_SRC_WORD[e.src] || '', typeof e.why === 'string' ? e.why : ''].filter(Boolean).join(' · ')) + '</span></span>' +
      (can ? '<span class="inv-row-end"><button type="button" class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invMktCalDel" data-date="' + d + '" aria-label="' + escHtml('Remove ' + d) + '">Remove</button></span>' : '') + '</div>';
  }).join('');
  if (can) body += '<div class="inv-panel-body"><div class="inv-fields">' +
    '<div class="inv-field"><label class="inv-field-label" for="mktCalDate">A day</label><input class="inv-input" type="date" id="mktCalDate" min="' + today + '"></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="mktCalState">The plant</label><select class="inv-select" id="mktCalState"><option value="shut">is shut</option><option value="works">works</option></select></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="mktCalSrc">Known from</label><select class="inv-select" id="mktCalSrc"><option value="circular">Tata’s circular</option><option value="owner">Elsewhere</option></select></div>' +
    '</div><div class="inv-field"><label class="inv-field-label" for="mktCalWhy">Why</label><input class="inv-input" id="mktCalWhy" autocomplete="off" placeholder="Block closure, a holiday worked"></div>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktCalAdd">Add the day</button></div></div>';
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-mkt-cal><div class="inv-panel-head"><span class="inv-panel-title">The plant’s week</span></div>' + body + '</div>';
}
function mktModelsPartHtml() {
  var can = mktCanEdit(), models = mktRead().models.map(function(w) { return String(w); });
  var chips = models.length ? models.map(function(w) {
    return can ? '<button type="button" class="inv-token" data-action="invMktModelDel" data-word="' + escHtml(w) + '" aria-label="' + escHtml('Stop following ' + w) + '">' + escHtml(w) + ' <span class="inv-token-key" aria-hidden="true">&times;</span></button>'
      : '<span class="inv-token">' + escHtml(w) + '</span>';
  }).join('') : '<span class="inv-note">No model followed.</span>';
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-mkt-models><div class="inv-panel-head"><span class="inv-panel-title">The models followed <span class="inv-panel-count">' + models.length + '</span></span></div>' +
    '<div class="inv-panel-body"><div class="inv-mkt-chips">' + chips + '</div>' +
    (can ? '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><input class="inv-input inv-toolbar-item" id="mktModelNew" autocomplete="off" maxlength="16" placeholder="A model, as the news writes it" aria-label="A model to follow">' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktModelAdd">Follow</button></div>' : '') +
    '<p class="inv-note">They pick the headlines out, and are the words the news is asked about: letters, digits, spaces and dots, 16 characters at most, 8 models at most.</p></div></div>';
}
function mktNewsPartHtml() {
  var model = _mktDlg ? _mktDlg.model : '', d = feedNews({ model: model, n: 6 });
  var chips = d.models && d.models.length ? '<div class="inv-mkt-chips" data-mkt-filter>' +
    '<button type="button" class="inv-chip" data-action="invMktChip" data-model="" aria-pressed="' + (!model) + '">All</button>' +
    d.models.map(function(x) { return '<button type="button" class="inv-chip" data-action="invMktChip" data-model="' + escHtml(x.word) + '" aria-pressed="' + (model === x.word) + '">' + escHtml(x.word) + ' <span class="inv-panel-count">' + x.n + '</span></button>'; }).join('') +
    '</div>' : '';
  // The dialog is its own door: a blank state here draws no button to Settings or the guide.
  var list = d.state === 'ok' ? d.items.map(feedNewsItemHtml).join('') : uiBlankHtml(Object.assign({}, d.blank, { action: '' }));
  var age = d.ago ? escHtml(d.ago) + (d.stale ? ' · the Worker’s last copy' : '') : '';
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-mkt-news><div class="inv-panel-head"><span class="inv-panel-title">Headlines' + (d.total ? ' <span class="inv-panel-count">' + d.total + '</span>' : '') + '</span>' +
      '<button type="button" class="inv-btn inv-btn-link inv-btn-sm" data-action="invFeedRefresh" data-kind="news">Refresh</button></div>' +
    (chips ? '<div class="inv-panel-body">' + chips + '</div>' : '') + list +
    '<div class="inv-row"><span class="inv-note">' + (age ? age + ' · ' : '') + 'News: <a class="inv-btn-link" href="' + FEED_CREDIT.news.url + '" target="_blank" rel="noopener noreferrer">' + escHtml(FEED_CREDIT.news.name) + '</a></span></div></div>';
}

/* What is typed in the month's form, read; {err} where a figure is not a whole number of units. */
function mktFormRead() {
  var v = function(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }, rec = {}, err = '';
  MKT_FIGS.forEach(function(f) {
    var x = { now: null, ly: null };
    ['now', 'ly'].forEach(function(w) {
      var s = v(mktFigId(f.key, w)).replace(/[\s,]/g, '');
      if (!s) return;
      if (!/^\d{1,7}$/.test(s)) { err = err || f.label + ': a figure is a whole number of units'; return; }
      x[w] = +s;
    });
    // Each figure is kept, a blank one null: a blank stays blank, and the change log names a figure that moved.
    rec[f.key] = x;
  });
  var rel = v('mktRel'), url = v('mktUrl'), note = v('mktNote').slice(0, 200);
  if (rel && !/^\d{4}-\d{2}-\d{2}$/.test(rel)) err = err || 'The day it was released does not read as a date';
  if (url && !feedSafeUrl(url)) err = err || 'The link must start with https://';
  if (rel) rec.released = rel;
  if (url) rec.url = feedSafeUrl(url);
  if (note) rec.note = note;
  return { rec: rec, err: err };
}
/* The month's form differs from what the book holds for it, or something is typed in the dialog's other fields. */
function mktFormDirty() {
  if (!_mktDlg || !document.getElementById('mktRel')) return false;
  var r = mktRead().tata[_mktDlg.month] || {}, f = mktFormRead().rec, typed = function(id) { var el = document.getElementById(id); return !!(el && String(el.value || '').trim()); };
  var differs = MKT_FIGS.some(function(x) { var a = mktFigOf(r, x.key), b = f[x.key]; return a.now !== b.now || a.ly !== b.ly; }) ||
    (r.released || '') !== (f.released || '') || (r.url || '') !== (f.url || '') || (r.note || '') !== (f.note || '');
  return differs || typed('mktModelNew') || typed('mktCalDate') || typed('mktCalWhy') || (mktFormRead().err !== '');
}
/* The dialog asks before it shuts only while something typed is not saved (dialogLeaveOk): after a save, a model followed or a day
   added, what remains is the record. */
function mktSyncTyped() {
  var dlg = document.querySelector('[data-mkt-tata]'), scrim = dlg && dlg.closest('.inv-scrim-dialog');
  if (!scrim) return;
  if (mktFormDirty()) scrim.dataset.typed = '1'; else delete scrim.dataset.typed;
}
function mktSaveMonth() {
  if (!_mktDlg) return;
  var m = _mktDlg.month, read = mktFormRead();
  if (read.err) { showToast(read.err, 'error'); return; }
  if (!mktTyped(read.rec)) { showToast('Type at least one figure from the release', 'error'); return; }
  if (!grdGate('settings', 'save Tata Motors’ figures', mktSaveMonth)) return;
  var t = mktData().tata;
  t[m] = Object.assign({ released: '', url: '', note: '' }, read.rec, { at: Date.now(), by: mktBy() });
  saveState();
  showToast(mktMonthLabel(m) + '’s figures saved');
  ['month', 'months', 'news'].forEach(mktPartRedraw);
  mktSyncTyped();
  if (typeof tabRedrawActive === 'function') { try { tabRedrawActive(); } catch (e) { /* the page under the dialog redraws on its next visit */ } }
}
/* A headline's figure put in its field for the owner to check: nothing is saved until Save. */
function mktUse(field, which, value) {
  var el = document.getElementById(mktFigId(field, which));
  if (!el || el.disabled) return;
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
  mktSyncTyped();
}
/* Another month: its own figures in the form, asked first when what was typed would go. */
async function mktSwitchMonth(m, sel) {
  if (!_mktDlg || !mktMonthOk(m) || m === _mktDlg.month) return;
  var was = _mktDlg.month;
  if (mktFormDirty() && !(await uiConfirm({ title: 'Discard what you typed?', body: 'What you typed for ' + mktMonthLabel(was) + ' is not saved. Keep editing to save it first, or discard it.',
    okLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) {
    if (sel && sel.isConnected) sel.value = was;
    return;
  }
  _mktDlg.month = m;
  ['month', 'months', 'calendar'].forEach(mktPartRedraw);
  var save = document.querySelector('[data-mkt-tata] [data-action="invMktSave"]');
  if (save) { save.dataset.month = m; save.textContent = 'Save ' + mktMonthName(m); }
  mktSyncTyped();
}
function mktCalSet(dates, state, src, why, url) {
  if (!grdGate('settings', 'change the plant’s calendar', function() { mktCalSet(dates, state, src, why, url); })) return;
  var cal = mktData().calendar, at = Date.now(), by = mktBy();
  dates.forEach(function(d) { cal[d] = { state: state, why: String(why || '').slice(0, 160), src: src, url: feedSafeUrl(url), at: at, by: by }; });
  saveState();
  showToast(dates.length === 1 ? 'Added to the calendar' : dates.length + ' days added to the calendar');
  mktPartRedraw('calendar');
  mktSyncTyped();
}
function mktCalAddHand() {
  var v = function(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var d = v('mktCalDate'), st = v('mktCalState') === 'works' ? 'works' : 'shut', src = v('mktCalSrc') === 'owner' ? 'owner' : 'circular';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { showToast('Pick the day first', 'error'); return; }
  mktCalSet([d], st, src, v('mktCalWhy'), '');
}
function mktCalOffer(btn) {
  var dates = String(btn.dataset.dates || '').split(',').filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
  if (!dates.length) return;
  var off = mktOffers(_mktDlg ? _mktDlg.month : null).calendar.find(function(o) { return o.dates.join(',') === dates.join(',') && o.state === btn.dataset.state; });
  mktCalSet(dates, btn.dataset.state === 'works' ? 'works' : 'shut', 'news', off ? off.title : '', btn.dataset.url || '');
}
function mktCalDel(d) {
  if (!grdGate('settings', 'change the plant’s calendar', function() { mktCalDel(d); })) return;
  var cal = mktData().calendar;
  if (!cal[d]) return;
  delete cal[d];
  saveState();
  mktPartRedraw('calendar');
  mktSyncTyped();
}
function mktModelAdd() {
  var el = document.getElementById('mktModelNew'), w = el ? String(el.value || '').replace(/\s+/g, ' ').trim() : '';
  if (!w) return;
  if (!MKT_MODEL_RE.test(w)) { showToast('A model is letters, digits, spaces and dots, 16 characters at most', 'error'); return; }
  var list = mktRead().models;
  if (list.some(function(x) { return String(x).toLowerCase() === w.toLowerCase(); })) { showToast(w + ' is followed already', 'warning'); return; }
  if (list.length >= MKT_MODELS_MAX) { showToast('Eight models at most: stop following one first', 'error'); return; }
  if (!grdGate('settings', 'change the models followed', mktModelAdd)) return;
  mktData().models = list.concat([w]);
  saveState();
  ['models', 'news'].forEach(mktPartRedraw);
  mktSyncTyped();
  var again = document.getElementById('mktModelNew');
  if (again) again.focus();
}
function mktModelDel(w) {
  if (!grdGate('settings', 'change the models followed', function() { mktModelDel(w); })) return;
  var list = mktRead().models.filter(function(x) { return String(x) !== w; });
  if (list.length === mktRead().models.length) return;
  mktData().models = list;
  if (_mktDlg && _mktDlg.model === w) _mktDlg.model = '';
  saveState();
  ['models', 'news'].forEach(mktPartRedraw);
  mktSyncTyped();
}
/* Close and the head's ×: asked first while something typed is not saved. The × has asked already when events.js clicks it again
   with the answer (`_leaving`), so it is not asked twice. */
async function mktClose() {
  var dlg = document.querySelector('[data-mkt-tata]'), scrim = dlg && dlg.closest('.inv-scrim-dialog');
  if (!scrim) return;
  if (!scrim._leaving) {
    mktSyncTyped();
    if (!(await dialogLeaveOk(scrim))) return;
  }
  _mktDlg = null;
  dialogCloseScrim(scrim);
}

/* ---------- Settings → Connections → News and weather ---------- */
function feedStatusHtml() {
  var n = feedNews({ n: 1 }), w = feedWeather();
  var row = function(kind, title, d, ok) {
    var via = (feedStoreRec(kind) || {}).via === 'direct' ? ' · straight from ' + FEED_SOURCE[kind] : '';
    var meta = d.state === 'ok' || (d.state === 'empty' && d.age) ? ok + (d.ago ? ' · ' + d.ago : '') + via + (d.stale ? ' · the Worker’s last copy' : '') + (d.offline ? ' · offline' : '')
      : d.blank ? d.blank.title + (d.blank.body ? ': ' + d.blank.body : '') : '';
    return '<div class="inv-row inv-row-2" data-feed-status-row="' + kind + '"><span class="inv-row-main"><span class="inv-row-title">' + title + '</span>' +
      '<span class="inv-row-meta">' + escHtml(meta) + '</span></span><span class="inv-row-end">' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFeedRefresh" data-kind="' + kind + '"' + (d.busy ? ' disabled' : '') + '>Refresh</button></span></div>';
  };
  var wx = feedDayViz();
  return '<div class="inv-panel inv-panel-flush inv-mt-8" data-feed-status>' +
    row('news', 'News', n, n.total ? todoPlural(n.total, 'headline') : 'no headlines') +
    row('weather', 'Weather' + (wx ? ' ' + wx.html : ''), w, w.now ? [w.now.word, w.now.tempText].filter(Boolean).join(', ') : '') + '</div>';
}
function feedStatusRedraw() {
  var el = document.querySelector('#settingsScrim [data-feed-status]');
  if (el) el.outerHTML = feedStatusHtml();
  var sum = document.querySelector('#settingsScrim [data-sum="feeds"]');
  if (sum) sum.innerHTML = FEED_SETTINGS_SEC.summary();
}
function feedFieldsHtml() {
  var c = (S && S.feedsCfg) || {}, cfg = feedCfg(), ck = (S && S.checkinCfg) || {};
  var qr = feedNum(ck.lat, -90, 90) != null && feedNum(ck.lng, -180, 180) != null;
  var lat = feedNum(c.lat, -90, 90) != null ? c.lat : qr ? ck.lat : '', lon = feedNum(c.lon, -180, 180) != null ? c.lon : qr ? ck.lng : '';
  // The address placed is shown, never filled in: saved, a filled field would write it into the book as typed.
  var geo = cfg.placeFrom === 'address' ? feedGeoRec() : null;
  var ph = function(v) { return geo && v != null ? ' placeholder="' + escHtml(v.toFixed(2)) + '"' : ''; };
  var origin = '';
  try { origin = location.origin && /^https?:/.test(location.origin) ? location.origin : ''; } catch (e) { origin = ''; }
  return '<div class="inv-field"><label class="inv-field-check" for="setFeedOn"><input type="checkbox" id="setFeedOn" class="inv-check"' + (cfg.on ? ' checked' : '') + '>' +
      '<span>Show the news and the weather</span></label>' +
      '<div class="inv-field-hint">Tata Motors’ news, the plant’s weather and the day card’s weather. Off, nothing is asked.</div></div>' +
    '<div class="inv-field"><label class="inv-field-label" for="setFeedUrl">The feeds Worker’s address</label>' +
      '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><input class="inv-input inv-toolbar-item" id="setFeedUrl" type="url" autocomplete="off" value="' + escHtml(c.url == null ? feedDefaults().url : c.url) + '" placeholder="' + escHtml(feedDefaults().url) + '">' +
      '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invFeedCheck">Check</button></div>' +
      '<div class="inv-field-hint">Blank is ' + escHtml(feedDefaults().url) + '. <strong>Check</strong> asks the address and says what came back. Optional: where it cannot be reached, the app asks GDELT and MET Norway itself.</div></div>' +
    '<div class="inv-callout" data-feed-check aria-live="polite"></div>' +
    '<div class="inv-fields">' +
      '<div class="inv-field"><label class="inv-field-label" for="setFeedLat">The plant’s latitude</label><input class="inv-input inv-input-num" type="number" inputmode="decimal" step="any" min="-90" max="90" id="setFeedLat" value="' + escHtml(lat == null ? '' : String(lat)) + '"' + ph(cfg.lat) + '></div>' +
      '<div class="inv-field"><label class="inv-field-label" for="setFeedLon">The plant’s longitude</label><input class="inv-input inv-input-num" type="number" inputmode="decimal" step="any" min="-180" max="180" id="setFeedLon" value="' + escHtml(lon == null ? '' : String(lon)) + '"' + ph(cfg.lon) + '></div>' +
    '</div>' +
    '<div class="inv-field"><label class="inv-field-label" for="setFeedPlace">A short name for the place</label><input class="inv-input" id="setFeedPlace" maxlength="40" autocomplete="off" value="' + escHtml(c.place || '') + '"' + (geo && geo.name ? ' placeholder="' + escHtml(geo.name) + '"' : '') + '>' +
      '<div class="inv-field-hint" data-feed-place="' + escHtml(cfg.placeFrom || 'none') + '">' + (cfg.placeFrom === 'checkin' ? 'The place is the Office QR’s, until another is typed here.'
        : geo ? 'From the company’s address: ' + escHtml(geo.name || 'the plant') + ' at ' + cfg.lat.toFixed(2) + ', ' + cfg.lon.toFixed(2) + ', placed on OpenStreetMap. Type another place to use it instead.'
        : qr ? 'The Office QR has a place too: this one is used.' : 'The weather is asked for this place, to 2 decimals (about a kilometre). Left blank, the company’s address is placed on the map.') + '</div></div>' +
    '<div class="inv-toolbar inv-toolbar-flush inv-toolbar-tight"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMktOpen">Tata Motors’ figures and the plant’s week</button></div>' +
    feedStatusHtml() +
    (origin ? '<p class="inv-note inv-mt-8">This app’s address, for the Worker’s ALLOWED_ORIGINS: <span class="inv-id">' + escHtml(origin) + '</span></p>' : '') +
    '<p class="inv-note inv-mt-4">News: <a class="inv-btn-link" href="' + FEED_CREDIT.news.url + '" target="_blank" rel="noopener noreferrer">' + escHtml(FEED_CREDIT.news.name) + '</a>. ' +
      'Weather: <a class="inv-btn-link" href="' + FEED_CREDIT.weather.url + '" target="_blank" rel="noopener noreferrer">' + escHtml(FEED_CREDIT.weather.name) + '</a>, ' + escHtml(FEED_CREDIT.weather.licence) + '.</p>';
}
/* The section's Save: on or off, the address (blank the default), the place (both or neither; the Office QR's, unchanged, is left to
   it so a place moved there is followed here). False, and said, where a field is not usable. */
function feedSaveCfg() {
  var v = function(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var on = document.getElementById('setFeedOn'), raw = v('setFeedUrl'), url = raw ? feedUrlOk(raw) : feedDefaults().url;
  if (!url) { showToast('The address must start with https://', 'error'); return false; }
  var la = v('setFeedLat'), lo = v('setFeedLon');
  var lat = la === '' ? null : feedNum(la, -90, 90), lon = lo === '' ? null : feedNum(lo, -180, 180);
  if ((la !== '' && lat == null) || (lo !== '' && lon == null) || (lat == null) !== (lon == null)) { showToast('Type both the latitude and the longitude, or leave both blank', 'error'); return false; }
  var ck = (S && S.checkinCfg) || {};
  if (lat != null && Math.abs(lat - Number(ck.lat)) < 1e-9 && Math.abs(lon - Number(ck.lng)) < 1e-9 && feedNum((S.feedsCfg || {}).lat, -90, 90) == null) { lat = null; lon = null; }
  S.feedsCfg = Object.assign({}, S.feedsCfg || {}, { on: !!(on && on.checked), url: url, lat: lat, lon: lon, place: v('setFeedPlace').slice(0, 40) });
}
/* Check: the address typed asked for /health, and what came back said (never saved, never a report). */
function feedCheck() {
  var out = document.querySelector('[data-feed-check]'), raw = (document.getElementById('setFeedUrl') || {}).value || '';
  var url = String(raw).trim() ? feedUrlOk(raw) : feedDefaults().url;
  var say = function(tone, text) {
    if (!out) return;
    out.className = 'inv-callout inv-callout-' + (tone === 'ok' ? 'neutral' : tone);
    out.dataset.feedCheck = tone;
    if (tone === 'ok') out.innerHTML = '<span class="inv-dot inv-dot-ok">Reached</span> ' + escHtml(text.replace(/^Reached: /, ''));
    else out.textContent = text;
  };
  if (!url) { say('warning', 'Not an address the app asks: it must start with https://.'); return Promise.resolve(false); }
  if (!feedOnline()) { say('warning', 'This device is offline: nothing was asked.'); return Promise.resolve(false); }
  if (!feedLive()) { say('neutral', 'Not asked: this browser is under test.'); return Promise.resolve(false); }
  say('info', 'Asking ' + url + '…');
  return feedAsk(url, '/health', '').then(function(r) {
    if (r.ok && r.json && typeof r.json === 'object' && r.json.ok === true) {
      var t = Date.parse(r.json.at || '');
      // The Worker answers, so the six hours the app holds it off after it could not be reached are over: Home asks it next.
      if ((feedStoreRec('direct') || {}).at) feedStorePut('direct', {});
      say('ok', 'Reached: the feeds Worker answered' + (isFinite(t) ? ', its clock at ' + formatTimestamp(t) : '') + '.');
      return true;
    }
    if (r.ok || r.why === 'nonsense') say('warning', 'It answered, but not as the feeds Worker does: check the address.');
    else if (r.why === 'refused') say('danger', 'Refused: the address answered ' + (r.status || 'with an error') + '. Check the address and the Worker’s settings.');
    else if (r.why === 'slow') say('warning', 'No answer in 8 seconds: try again, or check the address.');
    else say('danger', 'Not reachable: no answer from the address. Check it, and that the Worker allows this app’s address (ALLOWED_ORIGINS).');
    return false;
  });
}
var FEED_SETTINGS_SEC = {
  title: 'News and weather',
  guide: 'app-feeds',
  summary: function() {
    var c = feedCfg();
    if (!c.on) return 'off';
    if (!c.url) return 'no address';
    return escHtml(feedHost(c.url) + (c.lat != null ? ' · ' + (c.place || 'the plant') + ' at ' + c.lat.toFixed(2) + ', ' + c.lon.toFixed(2) : ' · no place set'));
  },
  body: function() { return feedFieldsHtml(); },
  why: 'The news comes from the GDELT Project and the weather from MET Norway, through the shop’s own feeds Worker on Cloudflare where it is set up, else asked of them straight from this device. ' +
    'The app asks only when Home is opened and its copy is over 30 minutes old, or when Refresh is tapped, and never offline. ' +
    'It sends the four news topics, the models followed and the plant’s place to two decimals: nothing of the book. With no place typed and none on the Office QR, the company’s address is placed once on OpenStreetMap. ' +
    'The copy stays on this device. A headline that gives a month’s figure, or names the plant shut on a day, is offered in the Tata dialog, never applied.',
  save: function() { return feedSaveCfg(); }
};
(function() {
  if (typeof SETTINGS_SECS === 'undefined' || typeof SETTINGS_GROUPS === 'undefined') return;
  SETTINGS_SECS.feeds = FEED_SETTINGS_SEC;
  var g = SETTINGS_GROUPS.find(function(x) { return x.key === 'connections'; });
  if (g && g.secs.indexOf('feeds') < 0) g.secs.push('feeds');
})();

/* ---------- Taps, picks, keys and landings ---------- */
function mktAction(action, btn) {
  switch (action) {
    case 'invMktOpen': mktTataOpen(btn.dataset.month); return true;
    case 'invMktClose': mktClose(); return true;
    case 'invMktSave': mktSaveMonth(); return true;
    case 'invMktUse': mktUse(btn.dataset.field, btn.dataset.which, btn.dataset.value); return true;
    case 'invMktMonth': mktSwitchMonth(btn.dataset.month, document.getElementById('mktMonth')); return true;
    case 'invMktCalOffer': mktCalOffer(btn); return true;
    case 'invMktCalAdd': mktCalAddHand(); return true;
    case 'invMktCalDel': mktCalDel(btn.dataset.date); return true;
    case 'invMktModelAdd': mktModelAdd(); return true;
    case 'invMktModelDel': mktModelDel(btn.dataset.word); return true;
    case 'invMktChip':
      if (_mktDlg) { _mktDlg.model = btn.dataset.model || ''; mktPartRedraw('news'); }
      return true;
    case 'invFeedCheck': feedCheck(); return true;
    case 'invFeedSettings': feedGo('settings'); return true;
    case 'invFeedGuide': feedGo('guide'); return true;
    case 'invFeedRefresh': {
      var kind = btn.dataset.kind;
      feedRefresh(kind).then(function(r) {
        if (r && r.why === 'gap') showToast('Asked a moment ago: again in ' + r.wait + ' s', 'info');
        else if (r && !r.ok && r.why && FEED_WHY_TEXT[r.why]) showToast('The ' + (FEED_NAME[kind] || 'feed') + ' was not fetched: ' + feedWhyText(r.why, r.status, r.via, kind), 'warning');
        else if (r && !r.ok && r.why === 'offline') showToast('This device is offline', 'warning');
      });
      return true;
    }
  }
  return false;
}
/* A <select> speaks through change: the dialog's month. */
function mktOnChange(el) {
  if (!el || el.id !== 'mktMonth' || !_mktDlg) return false;
  mktSwitchMonth(el.value, el);
  return true;
}
if (typeof document !== 'undefined' && document.addEventListener) {
  // Enter in the model's field follows it, as Add does in a toolbar.
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'mktModelNew') return;
    e.preventDefault();
    mktModelAdd();
  });
  // The dialog's typed mark follows the fields (state.js marks any field typed; this one clears it once the form is as saved).
  document.addEventListener('input', function(e) {
    if (e.target && e.target.closest && e.target.closest('[data-mkt-tata]')) mktSyncTyped();
  });
  // A copy landed: what is open and reads it is drawn again in place (the dialog's headlines and offers, Settings' status).
  document.addEventListener('sep-feeds', function() {
    try {
      if (document.querySelector('[data-mkt-tata]') && _mktDlg) { mktPartRedraw('news'); if (!mktFormDirty()) mktPartRedraw('month'); mktPartRedraw('calendar'); }
      feedStatusRedraw();
    } catch (e) { /* a redraw never takes a landing with it */ }
  });
}
