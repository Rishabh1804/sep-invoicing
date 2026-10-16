// The weather: MET Norway's Locationforecast 2.0, compact (docs/UI_PASS_3.md §9a). CC BY 4.0,
// free for commercial use with credit (WEATHER_CREDIT, in every answer). MET's terms require a
// User-Agent that names the caller and a contact; the contact is the CONTACT variable, set by
// the owner in the dashboard and never written in the repo.
//
// What is kept is MET's forecast as a series of steps; the answer is cut from it when asked
// (the next 48 hours, and 7 days by India's calendar day, UTC+5:30), so a copy served an hour
// after it was fetched starts at the hour it is served in, not the hour it was fetched in.

import { UpstreamError, upstreamGet, readBody, retryAfterMs, iso } from './upstream.js';

export const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const WEATHER_CREDIT = Object.freeze({ name: 'MET Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0' });
export const HOURS = 48;
export const DAYS = 7;

const HOUR = 3600000;
const DAY = 24 * HOUR;
const IST = 330 * 60000; // India, UTC+5:30
const FETCH_TIMEOUT_MS = 10000;

// lat and lon: numbers with at most 2 decimals, in range. Returns them as 2-decimal strings
// (the cache key and MET's URL) or {error}.
const COORD_RE = /^-?\d{1,3}(?:\.\d{1,2})?$/;
const fixed2 = (n) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
};
export function parsePlace(latRaw, lonRaw) {
  if (latRaw == null || lonRaw == null) return { error: 'lat and lon are needed, each to 2 decimals' };
  const a = latRaw.trim();
  const b = lonRaw.trim();
  if (!COORD_RE.test(a) || !COORD_RE.test(b)) return { error: 'lat and lon are numbers with at most 2 decimals' };
  const lat = Number(a);
  const lon = Number(b);
  if (!(lat >= -90 && lat <= 90)) return { error: 'lat is between -90 and 90' };
  if (!(lon >= -180 && lon <= 180)) return { error: 'lon is between -180 and 180' };
  return { lat: fixed2(lat), lon: fixed2(lon) };
}

export const metUrl = (lat, lon) => `${MET_URL}?lat=${lat}&lon=${lon}`;

// The contact as a header can carry it: printable ASCII, one line, 200 characters at most.
// '' when not set.
export function cleanContact(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export const userAgent = (contact) => `sep-feeds/1 ${contact}`;

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

// One of MET's periods (next_1_hours, next_6_hours, next_12_hours), only what the answer uses.
// A symbol code is MET's own word (partlycloudy_day, rainandthunder); anything else is dropped,
// since the app maps it to an icon.
function readPeriod(p) {
  if (!p || typeof p !== 'object') return undefined;
  const out = {};
  const sym = p.summary && p.summary.symbol_code;
  if (typeof sym === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(sym)) out.sym = sym;
  const d = p.details && typeof p.details === 'object' ? p.details : {};
  const rain = num(d.precipitation_amount, 0, 1000);
  if (rain !== undefined) out.rain = rain;
  const tmax = num(d.air_temperature_max, -100, 70);
  if (tmax !== undefined) out.tmax = tmax;
  const tmin = num(d.air_temperature_min, -100, 70);
  if (tmin !== undefined) out.tmin = tmin;
  // A probability is passed on only where MET's answer carries one (compact usually does not).
  const pp = num(d.probability_of_precipitation, 0, 100);
  if (pp !== undefined) out.pp = pp;
  const pt = num(d.probability_of_thunder, 0, 100);
  if (pt !== undefined) out.pt = pt;
  return Object.keys(out).length ? out : undefined;
}

// MET's compact JSON → {updated, series: [{t, temp?, p1?, p6?, p12?}]} in time order.
// Throws an UpstreamError when it holds no forecast at all.
export function readForecast(json) {
  const props = json && typeof json === 'object' ? json.properties : null;
  const steps = props && Array.isArray(props.timeseries) ? props.timeseries : null;
  if (!steps) throw new UpstreamError('MET Norway answered without a forecast');
  const series = [];
  for (const step of steps) {
    if (!step || typeof step.time !== 'string') continue;
    const t = Date.parse(step.time);
    if (!Number.isFinite(t)) continue;
    const d = step.data && typeof step.data === 'object' ? step.data : {};
    const row = { t };
    const temp = num(d.instant && d.instant.details && d.instant.details.air_temperature, -100, 70);
    if (temp !== undefined) row.temp = temp;
    const p1 = readPeriod(d.next_1_hours);
    if (p1) row.p1 = p1;
    const p6 = readPeriod(d.next_6_hours);
    if (p6) row.p6 = p6;
    const p12 = readPeriod(d.next_12_hours);
    if (p12) row.p12 = p12;
    series.push(row);
  }
  if (!series.length) throw new UpstreamError('MET Norway answered an empty forecast');
  series.sort((a, b) => a.t - b.t);
  const up = Date.parse(props.meta && props.meta.updated_at);
  return { updated: Number.isFinite(up) ? iso(up) : null, series };
}

const round1 = (x) => Math.round(x * 10) / 10;
const indiaDate = (ms) => iso(ms + IST).slice(0, 10);

// The answer's hours and days, as of `nowMs`, from a kept series.
//   hours: up to 48 steps with an hour's forecast, from the hour now is in: {t, temp, symbol, rain}.
//   days: up to 7 India days from today: {date, tMax, tMin, rain, thunder, symbol}.
// A day's figures come from the steps ahead of now: today's are the rest of today.
export function weatherAnswer(data, nowMs) {
  const from = Math.floor(nowMs / HOUR) * HOUR;
  const ahead = data.series.filter((s) => s.t >= from);

  const hours = [];
  for (const s of ahead) {
    if (!s.p1) continue;
    const h = { t: iso(s.t), temp: s.temp ?? null, symbol: s.p1.sym ?? null, rain: s.p1.rain ?? null };
    if (s.p1.pp !== undefined) h.rainProb = s.p1.pp;
    if (s.p1.pt !== undefined) h.thunderProb = s.p1.pt;
    hours.push(h);
    if (hours.length === HOURS) break;
  }

  const today = indiaDate(nowMs);
  const byDate = new Map();
  const dayOf = (date) => {
    let d = byDate.get(date);
    if (!d) {
      d = { date, tMax: null, tMin: null, rain: null, thunder: false, symbol: null, rank: 9, pp: null, pt: null };
      byDate.set(date, d);
    }
    return d;
  };
  const temp = (d, v) => {
    if (d.tMax === null || v > d.tMax) d.tMax = v;
    if (d.tMin === null || v < d.tMin) d.tMin = v;
  };
  const symbol = (d, sym, rank) => {
    if (sym && rank < d.rank) {
      d.symbol = sym;
      d.rank = rank;
    }
  };

  let covered = -Infinity; // the end of the last period counted, so none is counted twice
  for (const s of ahead) {
    if (s.temp !== undefined) temp(dayOf(indiaDate(s.t)), s.temp);
    // Each step speaks for the shortest period MET gives it: an hour while the forecast is
    // hourly, then six hours, then twelve. The period belongs to the India day its middle is in.
    let p;
    let len = 0;
    if (s.p1) [p, len] = [s.p1, HOUR];
    else if (s.p6) [p, len] = [s.p6, 6 * HOUR];
    else if (s.p12) [p, len] = [s.p12, 12 * HOUR];
    if (p && s.t >= covered) {
      covered = s.t + len;
      const d = dayOf(indiaDate(s.t + len / 2));
      if (p.rain !== undefined) d.rain = (d.rain ?? 0) + p.rain;
      if (p.tmax !== undefined) temp(d, p.tmax);
      if (p.tmin !== undefined) temp(d, p.tmin);
      if (p.sym && p.sym.includes('thunder')) d.thunder = true;
      if (p.pp !== undefined) d.pp = Math.max(d.pp ?? 0, p.pp);
      if (p.pt !== undefined) d.pt = Math.max(d.pt ?? 0, p.pt);
      symbol(d, p.sym, 3); // the day's first period ahead, unless one of the two below is there
    }
    // A day's own symbol is MET's for its working day: the 12 hours from 05:30 India time
    // (00:00 UTC), else the 6 from 11:30 (06:00 UTC).
    const ofDay = s.t % DAY;
    if (ofDay === 0 && s.p12) symbol(dayOf(indiaDate(s.t)), s.p12.sym, 1);
    else if (ofDay === 6 * HOUR && s.p6) symbol(dayOf(indiaDate(s.t)), s.p6.sym, 2);
  }

  const days = [];
  for (const d of [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (d.date < today) continue;
    const out = {
      date: d.date,
      tMax: d.tMax === null ? null : round1(d.tMax),
      tMin: d.tMin === null ? null : round1(d.tMin),
      rain: d.rain === null ? null : round1(d.rain),
      thunder: d.thunder || Boolean(d.symbol && d.symbol.includes('thunder')),
      symbol: d.symbol,
    };
    if (d.pp !== null) out.rainProb = d.pp;
    if (d.pt !== null) out.thunderProb = d.pt;
    days.push(out);
    if (days.length === DAYS) break;
  }
  return { hours, days };
}

// One request to MET. Returns {same: true, expires, lastModified} for a 304, else
// {same: false, updated, series, expires, lastModified}. Throws an UpstreamError.
export async function fetchForecast({ fetch: fetchFn, lat, lon, contact, lastModified, nowMs, timeoutMs = FETCH_TIMEOUT_MS }) {
  const headers = { 'User-Agent': userAgent(contact), Accept: 'application/json' };
  if (lastModified) headers['If-Modified-Since'] = lastModified;
  const res = await upstreamGet(fetchFn, 'MET Norway', metUrl(lat, lon), headers, timeoutMs);
  const expires = Date.parse(res.headers.get('Expires') || '');
  const modified = res.headers.get('Last-Modified');
  if (res.status === 304) return { same: true, expires, lastModified: modified || lastModified || null };
  // 203: MET still answers, saying the product is being retired; the forecast is good.
  if (res.status !== 200 && res.status !== 203) {
    throw new UpstreamError(`MET Norway answered ${res.status}`, retryAfterMs(res.headers.get('Retry-After'), nowMs));
  }
  const text = await readBody(res, 'MET Norway');
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UpstreamError('MET Norway answered something that is not JSON');
  }
  return { same: false, ...readForecast(json), expires, lastModified: modified || null };
}
