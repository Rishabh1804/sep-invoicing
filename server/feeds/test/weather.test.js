// The weather: what /weather accepts, what it sends MET Norway, how a forecast becomes 48 hours
// and 7 days by India's calendar day, and how the copy follows MET's Expires and Last-Modified.
import { describe, it, expect } from 'vitest';
import { parsePlace, cleanContact, readForecast, weatherAnswer } from '../src/weather.js';
import { makeApp, makeClock, makeUpstream, newBase, call, jsonResponse, deferred, CONTACT } from './helpers.js';
import { metCompact, forecast, step } from './fixtures/met.js';

const PLACE = '/weather?lat=22.79&lon=86.15';
const MIN = 60000;
const HOUR = 3600000;
const httpDate = (ms) => new Date(ms).toUTCString();
const LAST_MODIFIED = 'Fri, 16 Oct 2026 03:41:12 GMT';

// A MET that answers the realistic forecast, with an Expires `expiresIn` after the clock, and
// whatever `reply` says instead when it is given.
function metFor(clock, { expiresIn = 30 * MIN, reply = () => null, body = () => metCompact(), hold = () => null } = {}) {
  return makeUpstream({
    clock,
    met: async (url, c) => {
      const h = hold();
      if (h) await h;
      const r = reply(c);
      if (r) return r;
      return jsonResponse(body(c), {
        headers: { Expires: httpDate(clock.t + expiresIn), 'Last-Modified': LAST_MODIFIED },
      });
    },
  });
}

describe('the place', () => {
  it('takes lat and lon with at most 2 decimals, in range, as 2-decimal figures', () => {
    expect(parsePlace('22.79', '86.15')).toEqual({ lat: '22.79', lon: '86.15' });
    expect(parsePlace(' 22.8', '86 ')).toEqual({ lat: '22.80', lon: '86.00' });
    expect(parsePlace('-90', '180')).toEqual({ lat: '-90.00', lon: '180.00' });
    expect(parsePlace('-0', '-0.00')).toEqual({ lat: '0.00', lon: '0.00' });
  });

  it('refuses a third decimal, a figure out of range, and anything not a plain figure', () => {
    expect(parsePlace(null, '86.15').error).toBe('lat and lon are needed, each to 2 decimals');
    expect(parsePlace('22.79', null).error).toBe('lat and lon are needed, each to 2 decimals');
    for (const [lat, lon] of [
      ['22.791', '86.15'],
      ['22.79', '86.155'],
      ['abc', '86.15'],
      ['2.2e1', '86.15'],
      ['+22.79', '86.15'],
      ['', '86.15'],
      ['22,79', '86.15'],
      ['0x16', '86.15'],
      ['1234', '86.15'],
    ]) {
      expect(parsePlace(lat, lon).error, `${lat} ${lon}`).toBe('lat and lon are numbers with at most 2 decimals');
    }
    expect(parsePlace('90.01', '0').error).toBe('lat is between -90 and 90');
    expect(parsePlace('-91', '0').error).toBe('lat is between -90 and 90');
    expect(parsePlace('0', '180.01').error).toBe('lon is between -180 and 180');
    expect(parsePlace('0', '-999').error).toBe('lon is between -180 and 180');
  });

  it('answers 400 for a bad place and asks MET nothing', async () => {
    const clock = makeClock();
    const upstream = metFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    for (const path of ['/weather', '/weather?lat=22.79', '/weather?lat=22.791&lon=86.15', '/weather?lat=95&lon=86.15', '/weather?lat=x&lon=y']) {
      const { res, body } = await call(app, base, path);
      expect(res.status, path).toBe(400);
      expect(body.error, path).toMatch(/lat|lon/);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(upstream.calls).toHaveLength(0);
  });
});

describe('MET Norway asked as its terms require', () => {
  it('does not ask MET while CONTACT is not set, and says so', async () => {
    const clock = makeClock();
    const upstream = metFor(clock);
    const app = makeApp({ upstream, clock });
    for (const vars of [{ CONTACT: undefined }, { CONTACT: '' }, { CONTACT: ' \n\t ' }]) {
      const { res, body } = await call(app, newBase(), PLACE, { vars });
      expect(res.status).toBe(503);
      expect(body).toEqual({ error: 'CONTACT is not set on the Worker' });
    }
    expect(upstream.calls).toHaveLength(0);
  });

  it('names the Worker and its contact in the User-Agent, and asks for the compact forecast', async () => {
    const clock = makeClock();
    const upstream = metFor(clock);
    const { res } = await call(makeApp({ upstream, clock }), newBase(), PLACE);
    expect(res.status).toBe(200);
    const [c] = upstream.metCalls();
    expect(c.url.href).toBe('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=22.79&lon=86.15');
    expect(c.headers.get('User-Agent')).toBe(`sep-feeds/1 ${CONTACT}`);
    expect(c.headers.get('Accept')).toBe('application/json');
    expect(c.headers.get('If-Modified-Since')).toBeNull(); // nothing to compare with yet
  });

  it('keeps the contact to one printable line', () => {
    expect(cleanContact('  https://shop.example.in\r\nX-Evil: 1 ')).toBe('https://shop.example.in X-Evil: 1');
    expect(cleanContact('owner@exämple.in')).toBe('owner@ex mple.in');
    expect(cleanContact('a'.repeat(300))).toHaveLength(200);
    expect(cleanContact(undefined)).toBe('');
  });

  it('asks MET for the place as 2-decimal figures, whatever way they were written', async () => {
    const clock = makeClock();
    const upstream = metFor(clock);
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const { body } = await call(app, base, '/weather?lat=22.8&lon=86');
    expect(upstream.metCalls()[0].url.search).toBe('?lat=22.80&lon=86.00');
    expect(body.lat).toBe(22.8);
    expect(body.lon).toBe(86);
    await call(app, base, '/weather?lon=86.00&lat=22.80&units=imperial'); // the same place: the same copy
    expect(upstream.metCalls()).toHaveLength(1);
  });
});

describe('the forecast, read', () => {
  it('answers the next 48 hours from the hour now is in, and 7 days from today in India', async () => {
    const clock = makeClock('2026-10-16T04:10:00Z'); // 09:40 in India
    const upstream = metFor(clock);
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), PLACE);
    expect(res.status).toBe(200);
    expect(Object.keys(body)).toEqual(['at', 'updated', 'lat', 'lon', 'hours', 'days', 'credit']);
    expect(body).toMatchObject({ at: '2026-10-16T04:10:00.000Z', updated: '2026-10-16T03:41:12.000Z', lat: 22.79, lon: 86.15 });
    expect(body.credit).toEqual({ name: 'MET Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0' });
    expect(body.hours).toHaveLength(48);
    body.hours.forEach((h, k) => {
      expect(Object.keys(h)).toEqual(['t', 'temp', 'symbol', 'rain']);
      expect(h.t).toBe(new Date(Date.parse('2026-10-16T04:00:00Z') + k * HOUR).toISOString());
    });
    expect(body.hours[0]).toEqual({ t: '2026-10-16T04:00:00.000Z', temp: 28.3, symbol: 'partlycloudy_day', rain: 0 });
    expect(body.days.map((d) => d.date)).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
    for (const d of body.days) expect(Object.keys(d)).toEqual(['date', 'tMax', 'tMin', 'rain', 'thunder', 'symbol']);
    // the fixture's day runs 22 °C before dawn to 32 °C mid-afternoon; today is what is left of it
    expect(body.days[0]).toEqual({ date: '2026-10-16', tMax: 32, tMin: 23.5, rain: 0, thunder: false, symbol: 'partlycloudy_day' });
    expect(body.days[3]).toEqual({ date: '2026-10-19', tMax: 32, tMin: 22, rain: 0, thunder: false, symbol: 'partlycloudy_day' });
  });

  it('puts each hour on the India day its middle falls in, so 18:00 UTC is the next day', () => {
    const data = readForecast(
      forecast([
        step('2026-10-16T17:00:00Z', { temp: 25.0, p1: { sym: 'cloudy', rain: 0.4 } }), // 22:30 India, 16 Oct
        step('2026-10-16T18:00:00Z', { temp: 24.6, p1: { sym: 'lightrain', rain: 1.0 } }), // 23:30 to 00:30
        step('2026-10-16T19:00:00Z', { temp: 24.1, p1: { sym: 'heavyrainandthunder', rain: 3.2 } }),
        step('2026-10-16T20:00:00Z', { temp: 23.9, p1: { sym: 'cloudy', rain: 0.15 } }),
      ]),
    );
    const evening = weatherAnswer(data, Date.parse('2026-10-16T17:10:00Z')); // 22:40 India
    expect(evening.hours.map((h) => h.t)).toEqual([
      '2026-10-16T17:00:00.000Z',
      '2026-10-16T18:00:00.000Z',
      '2026-10-16T19:00:00.000Z',
      '2026-10-16T20:00:00.000Z',
    ]);
    expect(evening.days).toEqual([
      // the 23:30 reading is the 16th's; the hour from 23:30 is the 17th's rain
      { date: '2026-10-16', tMax: 25, tMin: 24.6, rain: 0.4, thunder: false, symbol: 'cloudy' },
      { date: '2026-10-17', tMax: 24.1, tMin: 23.9, rain: 4.4, thunder: true, symbol: 'lightrain' },
    ]);
    // ten minutes past midnight in India: today is the 17th, and the 16th is gone
    const night = weatherAnswer(data, Date.parse('2026-10-16T18:40:00Z'));
    expect(night.hours[0].t).toBe('2026-10-16T18:00:00.000Z'); // the hour now is in
    expect(night.days.map((d) => d.date)).toEqual(['2026-10-17']);
  });

  it('reads thunder from the symbol codes, and a day under a thunder symbol has thunder', () => {
    const data = readForecast(
      forecast([
        step('2026-10-17T21:00:00Z', { temp: 22.2, p1: { sym: 'clearsky_night', rain: 0 }, p6: { sym: 'cloudy', rain: 9.9 }, p12: { sym: 'cloudy' } }),
        step('2026-10-17T22:00:00Z', { temp: 22.0, p1: { sym: 'clearsky_night', rain: 0 } }),
        step('2026-10-17T23:00:00Z', { temp: 22.1, p1: { sym: 'fair_night', rain: 0 } }),
        step('2026-10-18T00:00:00Z', { temp: 22.4, p1: { sym: 'fair_day', rain: 0.2 }, p12: { sym: 'rainshowersandthunder_day' } }),
      ]),
    );
    const { hours, days } = weatherAnswer(data, Date.parse('2026-10-17T21:30:00Z')); // 03:00 India, 18 Oct
    expect(hours.some((h) => h.symbol.includes('thunder'))).toBe(false);
    // the 12 hours from 05:30 India are the day's symbol; an hour's rain is counted, never the 6 hours over it too
    expect(days).toEqual([{ date: '2026-10-18', tMax: 22.4, tMin: 22, rain: 0.2, thunder: true, symbol: 'rainshowersandthunder_day' }]);
  });

  it('reads the 6-hour steps past the hourly ones: their rain once, their highs and lows, 11:30 to 17:30 the symbol', () => {
    const data = readForecast(
      forecast([
        step('2026-10-19T00:00:00Z', { temp: 21.8, p6: { sym: 'cloudy', rain: 0.5, tmax: 26.0, tmin: 21.8 } }),
        step('2026-10-19T06:00:00Z', { temp: 27.5, p6: { sym: 'lightrain', rain: 2.0, tmax: 31.2, tmin: 27.5 }, p12: { sym: 'rain' } }),
        step('2026-10-19T12:00:00Z', { temp: 26.0, p6: { sym: 'cloudy', rain: 0, tmax: 27.0, tmin: 24.1 } }),
        step('2026-10-19T18:00:00Z', { temp: 23.0, p6: { sym: 'fair', rain: 0.3, tmax: 23.0, tmin: 22.0 } }), // 23:30 to 05:30
        step('2026-10-20T00:00:00Z', { temp: 22.0 }),
      ]),
    );
    const { hours, days } = weatherAnswer(data, Date.parse('2026-10-19T00:00:00Z'));
    expect(hours).toEqual([]); // no step has an hour's forecast
    expect(days).toEqual([
      { date: '2026-10-19', tMax: 31.2, tMin: 21.8, rain: 2.5, thunder: false, symbol: 'lightrain' },
      { date: '2026-10-20', tMax: 23, tMin: 22, rain: 0.3, thunder: false, symbol: 'fair' },
    ]);
  });

  it('passes a probability on only where MET gives one', () => {
    const data = readForecast(
      forecast([
        step('2026-10-16T04:00:00Z', { temp: 28, p1: { sym: 'cloudy', rain: 0, pp: 40, pt: 10 } }),
        step('2026-10-16T05:00:00Z', { temp: 29, p1: { sym: 'cloudy', rain: 0.1, pp: 65 } }),
      ]),
    );
    const { hours, days } = weatherAnswer(data, Date.parse('2026-10-16T04:00:00Z'));
    expect(hours[0]).toEqual({ t: '2026-10-16T04:00:00.000Z', temp: 28, symbol: 'cloudy', rain: 0, rainProb: 40, thunderProb: 10 });
    expect(hours[1]).toEqual({ t: '2026-10-16T05:00:00.000Z', temp: 29, symbol: 'cloudy', rain: 0.1, rainProb: 65 });
    expect(days[0]).toMatchObject({ rainProb: 65, thunderProb: 10 });
    const plain = weatherAnswer(readForecast(metCompact()), Date.parse('2026-10-16T04:10:00Z'));
    expect(plain.hours.some((h) => 'rainProb' in h || 'thunderProb' in h)).toBe(false);
    expect(plain.days.some((d) => 'rainProb' in d || 'thunderProb' in d)).toBe(false);
  });

  it('drops what is not a forecast, and refuses an answer with none', () => {
    const data = readForecast(
      forecast(
        [
          step('2026-10-16T04:00:00Z', { temp: 999, p1: { sym: 'Partly Cloudy<script>', rain: 0.2 } }),
          step('yesterday', { temp: 20, p1: { sym: 'cloudy', rain: 0 } }),
          { time: 42 },
          null,
          step('2026-10-16T05:00:00Z', { temp: 27.5, p1: { sym: 'cloudy', rain: 0.3 } }),
          step('2026-10-16T06:00:00Z', { temp: 28, p1: { sym: '<b>', rain: -1 } }), // nothing left of its hour
        ],
        'not a date',
      ),
    );
    expect(data.updated).toBeNull();
    const { hours } = weatherAnswer(data, Date.parse('2026-10-16T04:00:00Z'));
    expect(hours).toEqual([
      { t: '2026-10-16T04:00:00.000Z', temp: null, symbol: null, rain: 0.2 },
      { t: '2026-10-16T05:00:00.000Z', temp: 27.5, symbol: 'cloudy', rain: 0.3 },
    ]);
    expect(() => readForecast({ properties: {} })).toThrow('MET Norway answered without a forecast');
    expect(() => readForecast(null)).toThrow('MET Norway answered without a forecast');
    expect(() => readForecast(forecast([]))).toThrow('MET Norway answered an empty forecast');
    expect(() => readForecast(forecast([{ time: 'soon' }]))).toThrow('MET Norway answered an empty forecast');
  });
});

describe('the copy', () => {
  it('serves a copy as of the hour it is served in, and asks MET nothing before its Expires', async () => {
    const clock = makeClock('2026-10-16T04:10:00Z');
    const upstream = metFor(clock, { expiresIn: 5 * HOUR });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, PLACE);
    clock.advance(2 * HOUR);
    const later = await call(app, base, PLACE);
    await later.settle();
    expect(upstream.metCalls()).toHaveLength(1);
    expect(later.body.at).toBe(first.body.at); // the same copy
    expect(later.body.hours[0].t).toBe('2026-10-16T06:00:00.000Z'); // cut from it at the hour it is served in
    expect(later.body.hours).toHaveLength(48);
  });

  it('serves a copy past its Expires at once, revalidates it with If-Modified-Since, and keeps it on a 304', async () => {
    const clock = makeClock('2026-10-16T04:10:00Z');
    let gate = null;
    let notModified = false;
    const upstream = metFor(clock, {
      hold: () => gate && gate.promise,
      reply: () =>
        notModified ? new Response(null, { status: 304, headers: { Expires: httpDate(clock.t + HOUR), 'Last-Modified': LAST_MODIFIED } }) : null,
    });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, PLACE);

    clock.advance(31 * MIN);
    notModified = true;
    gate = deferred();
    const due = await call(app, base, PLACE); // MET held open: this answer did not wait for it
    expect(due.res.status).toBe(200);
    expect(due.body.at).toBe(first.body.at);
    expect(upstream.metCalls()).toHaveLength(2);
    expect(upstream.metCalls()[1].headers.get('If-Modified-Since')).toBe(LAST_MODIFIED);
    gate.resolve();
    await due.settle();

    const next = await call(app, base, PLACE);
    expect(next.body.at).toBe(new Date(clock.t).toISOString()); // checked now
    expect(next.body.updated).toBe(first.body.updated); // the forecast itself is the same
    expect(next.body.days).toEqual(due.body.days);
    expect(next.body.stale).toBeUndefined();

    clock.advance(59 * MIN); // the 304's Expires holds
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(2 * MIN);
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(3);
  });

  it('reads 30 minutes where MET sends no Expires, and never less than a minute', async () => {
    const clock = makeClock();
    let expires = null;
    const upstream = makeUpstream({
      clock,
      met: () => jsonResponse(metCompact(), { headers: expires === null ? {} : { Expires: expires } }),
    });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    await call(app, base, PLACE);
    clock.advance(29 * MIN);
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(1);
    clock.advance(2 * MIN);
    expires = httpDate(clock.t - HOUR); // an Expires already past
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(30 * 1000);
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(31 * 1000);
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(3);
  });

  it('takes a 203 as a forecast (MET retiring the product still answers it)', async () => {
    const clock = makeClock();
    const upstream = makeUpstream({ clock, met: () => jsonResponse(metCompact(), { status: 203 }) });
    const { res, body } = await call(makeApp({ upstream, clock }), newBase(), PLACE);
    expect(res.status).toBe(200);
    expect(body.hours).toHaveLength(48);
  });

  it('serves the last copy with stale: true when MET fails, and tries again five minutes on', async () => {
    const clock = makeClock();
    let failing = false;
    const upstream = metFor(clock, { reply: () => (failing ? new Response('busy', { status: 500 }) : null) });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, PLACE);
    clock.advance(31 * MIN);
    failing = true;
    await (await call(app, base, PLACE)).settle();
    const stale = await call(app, base, PLACE);
    expect(stale.res.status).toBe(200);
    expect(stale.body.stale).toBe(true);
    expect(stale.body.error).toBe('MET Norway answered 500');
    expect(stale.body.at).toBe(first.body.at);
    expect(stale.body.hours.length).toBeGreaterThan(0);
    await stale.settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(5 * MIN);
    failing = false;
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(3);
    const mended = await call(app, base, PLACE);
    expect(mended.body.stale).toBeUndefined();
    expect(mended.body.error).toBeUndefined();
  });

  it('waits what Retry-After asks before trying again, up to an hour', async () => {
    const clock = makeClock();
    let failing = false;
    const upstream = metFor(clock, {
      reply: () => (failing ? new Response('slow down', { status: 429, headers: { 'Retry-After': '1200' } }) : null),
    });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    await call(app, base, PLACE);
    clock.advance(31 * MIN);
    failing = true;
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(6 * MIN); // past five minutes, short of twenty
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(2);
    clock.advance(15 * MIN);
    await (await call(app, base, PLACE)).settle();
    expect(upstream.metCalls()).toHaveLength(3);
  });

  it('answers 503 with no copy at all, and does not ask again for five minutes', async () => {
    const clock = makeClock();
    let answer = () => new Response('down', { status: 502 });
    const upstream = makeUpstream({ clock, met: () => answer() });
    const app = makeApp({ upstream, clock });
    const base = newBase();
    const first = await call(app, base, PLACE);
    expect(first.res.status).toBe(503);
    expect(first.body).toEqual({ error: 'MET Norway answered 502' });
    clock.advance(4 * MIN);
    const second = await call(app, base, PLACE);
    expect(second.res.status).toBe(503);
    expect(upstream.metCalls()).toHaveLength(1);
    clock.advance(2 * MIN);
    answer = () => jsonResponse(metCompact());
    const third = await call(app, base, PLACE);
    expect(third.res.status).toBe(200);
    expect(upstream.metCalls()).toHaveLength(2);
  });

  it('says what came back when it is not a forecast', async () => {
    for (const [reply, error] of [
      [() => new Response('<html>Service Unavailable</html>', { status: 200 }), 'MET Norway answered something that is not JSON'],
      [() => jsonResponse({ type: 'Feature', properties: {} }), 'MET Norway answered without a forecast'],
      [() => new Response(null, { status: 304 }), 'MET Norway answered 304 with no copy here'],
      [
        async () => {
          throw new TypeError('Network connection lost.');
        },
        'MET Norway could not be reached',
      ],
    ]) {
      const clock = makeClock();
      const upstream = makeUpstream({ clock, met: reply });
      const { res, body } = await call(makeApp({ upstream, clock }), newBase(), PLACE);
      expect(res.status).toBe(503);
      expect(body).toEqual({ error });
    }
  });
});
