// The news: Tata Motors' headlines from the GDELT Project's DOC 2.0 API (docs/UI_PASS_3.md §9a).
// GDELT's data is free for commercial use with a citation and a link (NEWS_CREDIT, in every answer).
// One query a topic; each answer becomes at most 25 headlines {title, url, source, at, lang}.
// A headline is untrusted text: the app escapes it, and this file keeps only what reads as a
// title (no tags, entities decoded, 200 characters at most) and a link that is http(s) and
// nothing else.

import { UpstreamError, upstreamGet, readBody, oneLine, iso } from './upstream.js';

export const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';
export const NEWS_CREDIT = Object.freeze({ name: 'The GDELT Project', url: 'https://www.gdeltproject.org/' });

export const NEWS_MAX_ITEMS = 25;
export const TITLE_MAX = 200;
export const MODELS_MAX = 8;
export const MODEL_MAX_LEN = 16;
// GDELT asks for spaced requests: a refresh asks for its topics one after another, each started
// at least this long after the one before.
export const NEWS_GAP_MS = 6000;
// A refresh runs inside the 30 s Cloudflare allows after an answer (ctx.waitUntil); four topics
// 6 s apart start by 18 s, so each request's own time-out is cut to what is left of this.
export const NEWS_BUDGET_MS = 25000;
const FETCH_TIMEOUT_MS = 10000;
const MIN_FETCH_MS = 2000;
const URL_MAX = 2000;

// The four topics and their queries, in the order an answer lists them.
export const TOPICS = Object.freeze({
  'tata-cv': () => '"tata motors" (sales OR trucks OR "commercial vehicles") sourcecountry:IN',
  'tata-plant': () => '"tata motors" jamshedpur',
  'tata-models': (models) => modelsQuery(models),
  'tata-exports': () => '"tata motors" (exports OR "international business")',
});
export const TOPIC_IDS = Object.freeze(Object.keys(TOPICS));

// One quoted phrase a model word; GDELT takes parentheses only round an OR, so one word stands alone.
export function modelsQuery(models) {
  const phrases = models.map((m) => `"tata ${m}"`);
  return phrases.length > 1 ? `(${phrases.join(' OR ')})` : phrases[0];
}

export function topicQuery(id, models) {
  return TOPICS[id](models);
}

export function gdeltUrl(query) {
  return (
    `${GDELT_DOC}?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&format=json&maxrecords=${NEWS_MAX_ITEMS}&timespan=14d&sort=DateDesc`
  );
}

const clipIn = (s, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// `topics`: a comma list of the four ids. Returns {topics} in TOPIC_IDS order, or {error}.
export function parseTopics(raw) {
  const ids = [];
  for (const part of String(raw ?? '').split(',')) {
    const id = part.trim().toLowerCase();
    if (!id) continue;
    if (!Object.hasOwn(TOPICS, id)) return { error: `Unknown topic: ${clipIn(part.trim())}` };
    if (!ids.includes(id)) ids.push(id);
  }
  if (!ids.length) return { error: `topics is needed: any of ${TOPIC_IDS.join(', ')}` };
  return { topics: TOPIC_IDS.filter((id) => ids.includes(id)) };
}

// `models`: up to 8 words of letters, digits, spaces and dots, 16 characters each. Returns
// {models} lowercased, without repeats and sorted (GDELT does not read case, and the cache key
// must not depend on the order sent), or {error}. Empty items between commas are passed over.
export function parseModels(raw) {
  if (raw == null) return { models: [] };
  if (raw.length > 200) return { error: 'models is too long' };
  const out = [];
  for (const part of raw.split(',')) {
    const word = part.trim().replace(/\s+/g, ' ');
    if (!word) continue;
    if (word.length > MODEL_MAX_LEN) {
      return { error: `A model is ${MODEL_MAX_LEN} characters at most: ${clipIn(word)}` };
    }
    if (!/^[A-Za-z0-9. ]+$/.test(word) || !/[A-Za-z0-9]/.test(word)) {
      return { error: `A model is letters, digits, spaces and dots: ${clipIn(word)}` };
    }
    const key = word.toLowerCase();
    if (!out.includes(key)) out.push(key);
  }
  if (out.length > MODELS_MAX) return { error: `At most ${MODELS_MAX} models` };
  return { models: out.sort() };
}

// HTML's named entities a headline is likely to carry: the Latin-1 set (160–255, in order) and
// the punctuation and symbols HTML 4 names. A name not here is left as written.
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn ' +
  'sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave ' +
  'Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN ' +
  'szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute ' +
  'icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml ' +
  'yacute thorn yuml';
const ENTITIES = Object.assign(Object.create(null), {
  quot: 34, amp: 38, apos: 39, lt: 60, gt: 62, OElig: 338, oelig: 339, Scaron: 352, scaron: 353,
  Yuml: 376, fnof: 402, circ: 710, tilde: 732, ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204,
  zwj: 8205, lrm: 8206, rlm: 8207, ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218,
  ldquo: 8220, rdquo: 8221, bdquo: 8222, dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230,
  permil: 8240, prime: 8242, Prime: 8243, lsaquo: 8249, rsaquo: 8250, euro: 8364, trade: 8482,
  larr: 8592, uarr: 8593, rarr: 8594, darr: 8595, minus: 8722,
});
LATIN1.split(' ').forEach((name, i) => {
  ENTITIES[name] = 160 + i;
});
// A numeric reference in 128–159 means the Windows-1252 character, as a browser reads it.
const CP1252 = {
  128: 8364, 130: 8218, 131: 402, 132: 8222, 133: 8230, 134: 8224, 135: 8225, 136: 710, 137: 8240,
  138: 352, 139: 8249, 140: 338, 142: 381, 145: 8216, 146: 8217, 147: 8220, 148: 8221, 149: 8226,
  150: 8211, 151: 8212, 152: 732, 153: 8482, 154: 353, 155: 8250, 156: 339, 158: 382, 159: 376,
};
const ENTITY_RE = /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g;

export function decodeEntities(s) {
  return s.replace(ENTITY_RE, (whole, body) => {
    if (body[0] !== '#') {
      const cp = ENTITIES[body];
      return cp === undefined ? whole : String.fromCodePoint(cp);
    }
    let cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    cp = CP1252[cp] || cp;
    if (!(cp > 0 && cp <= 0x10ffff) || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
    return String.fromCodePoint(cp);
  });
}

// A tag is `<` straight after by a letter (or `</` and a letter) up to the next `>`, so
// "sales < 5% > last year" is text. A tag that breaks a line becomes a space, any other nothing.
const TAG_RE = /<\/?([A-Za-z][A-Za-z0-9]*)[^<>]*>/g;
const BREAKING = /^(br|p|div|li|tr|td|th|h[1-6])$/i;
const dropTags = (s) => s.replace(TAG_RE, (_, name) => (BREAKING.test(name) ? ' ' : ''));

// The title as a person reads it, whole: tags dropped (those written raw, then those written as
// entities), entities decoded, control and zero-width characters out, spaces collapsed.
export function cleanTitleText(raw) {
  if (typeof raw !== 'string') return '';
  return dropTags(decodeEntities(dropTags(raw)))
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// At most `max` characters (code points, so a pair is never split), the last an ellipsis when cut.
export function clipTitle(s, max = TITLE_MAX) {
  if (s.length <= max) return s;
  const cps = Array.from(s);
  if (cps.length <= max) return s;
  return `${cps.slice(0, max - 1).join('').trimEnd()}…`;
}

// Two headlines are the same when their letters and digits are, whatever the case and punctuation.
export const titleKey = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// https or http only, never a link with a user name or password in it (it can pass for another site).
function readUrl(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > URL_MAX) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !u.hostname) return null;
  return u;
}

export function cleanUrl(raw) {
  const u = readUrl(raw);
  return u ? u.href : null;
}

// The source is the link's own site, without its www.
const sourceOf = (u) => u.hostname.replace(/^www\./, '');

// GDELT's seen date, 20261015T084500Z, as an ISO time; null when it does not read.
export function seenAt(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw.trim());
  let ms;
  if (m) {
    ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const back = new Date(ms);
    if (back.getUTCMonth() !== +m[2] - 1 || back.getUTCDate() !== +m[3] || back.getUTCHours() !== +m[4]) return null;
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    ms = Date.parse(raw);
  }
  return Number.isFinite(ms) ? iso(ms) : null;
}

const langOf = (raw) => (typeof raw === 'string' && raw.trim() ? clipIn(raw.trim()) : null);

// GDELT's ArtList answer → at most 25 headlines, in GDELT's order (newest first). An article
// with no usable title or link is passed over; the same title (or link) twice is kept once.
export function normaliseArticles(json) {
  const list = json && Array.isArray(json.articles) ? json.articles : [];
  const items = [];
  const titles = new Set();
  const urls = new Set();
  for (const a of list) {
    if (items.length >= NEWS_MAX_ITEMS) break;
    if (!a || typeof a !== 'object') continue;
    const u = readUrl(a.url);
    if (!u) continue;
    const full = cleanTitleText(a.title);
    if (!full) continue;
    const key = titleKey(full);
    const url = u.href;
    if (titles.has(key) || urls.has(url)) continue;
    titles.add(key);
    urls.add(url);
    items.push({ title: clipTitle(full), url, source: sourceOf(u), at: seenAt(a.seendate), lang: langOf(a.language) });
  }
  return items;
}

// GDELT has been known to send JSON a strict parser refuses (a raw control character, a stray
// backslash). Read it strictly first; only if that fails, mend those two things and try once more.
export function parseLooseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const mended = text
      .replace(/[\u0000-\u001f]/g, ' ')
      .replace(/\\(.?)/gs, (whole, next) => ('"\\/bfnrtu'.includes(next) && next ? whole : next));
    try {
      return JSON.parse(mended);
    } catch {
      return undefined;
    }
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// One topic's headlines. Throws an UpstreamError saying what went wrong.
export async function fetchTopic(fetchFn, url, timeoutMs) {
  const res = await upstreamGet(fetchFn, 'GDELT', url, { 'User-Agent': 'sep-feeds/1', Accept: 'application/json' }, timeoutMs);
  const text = await readBody(res, 'GDELT');
  const said = () => oneLine(dropTags(text)); // what came back, as one line of text, for an error
  if (!res.ok) {
    const s = said();
    throw new UpstreamError(`GDELT answered ${res.status}${s ? `: ${s}` : ''}`);
  }
  const json = parseLooseJson(text);
  if (json === undefined) {
    // GDELT answers a query it cannot run, or too many requests, with a line of plain text.
    const s = said();
    throw new UpstreamError(s ? `GDELT answered: ${s}` : 'GDELT answered nothing');
  }
  if (!isPlainObject(json)) throw new UpstreamError('GDELT answered something other than an article list');
  if (!Array.isArray(json.articles)) {
    if (Object.keys(json).length === 0) return []; // GDELT's answer when nothing matched
    throw new UpstreamError('GDELT answered without an article list');
  }
  return normaliseArticles(json);
}

// A refresh: every topic asked one after another, spaced. A topic that fails keeps what it had
// (`prev`, the last copy's topics) and says so ({stale: true, error}); one that has never been
// fetched reads {at: null, items: []}. Never throws.
export async function refreshNews({ fetch: fetchFn, now, sleep, gapMs = NEWS_GAP_MS, budgetMs = NEWS_BUDGET_MS, topics, models, prev, log }) {
  const deadline = now() + budgetMs;
  const out = {};
  let failed = 0;
  let lastStart = null;
  for (const id of topics) {
    if (lastStart !== null) {
      const wait = lastStart + gapMs - now();
      if (wait > 0) await sleep(wait);
    }
    const before = prev && prev[id];
    const left = deadline - now();
    try {
      if (left < MIN_FETCH_MS) throw new UpstreamError('No time was left in this refresh');
      lastStart = now();
      const items = await fetchTopic(fetchFn, gdeltUrl(topicQuery(id, models)), Math.min(FETCH_TIMEOUT_MS, left));
      out[id] = { at: iso(now()), items };
    } catch (e) {
      failed += 1;
      const error = e instanceof UpstreamError ? e.message : 'GDELT answered something this Worker could not read';
      if (log) log(`news ${id}: ${error}`);
      out[id] = { at: before ? before.at : null, items: before ? before.items : [], stale: true, error };
    }
  }
  return { at: iso(now()), topics: out, failed };
}
