import { expect, type Page, type Route } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, type SepState } from './fixtures';

/*
 * P225's fake feeds Worker (docs/UI_PASS_3.md §9a, feeds.js). The app's default address is answered by page.route with the CORS
 * header the real Worker sends; every call is recorded. Every headline, link, source and place here is made up: the coordinates
 * are nowhere near the plant, and nothing of the owner's is in the repo.
 */
export const FEED_BASE = 'https://feeds.somaelectro.co.in';
export const FAKE_LAT = 10.1234, FAKE_LON = 20.4567;      // asked as lat=10.12&lon=20.46
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type FeedCall = { url: string; path: string; params: Record<string, string>; method: string; headers: Record<string, string>; body: string | null };
export type FeedReply = { status?: number; json?: unknown; text?: string; delayMs?: number; abort?: boolean };

/* The feeds asked for under test: the app keeps them quiet in a browser driven by a test (as errors.js does) unless this is set
   before it loads. */
export async function feedsOn(page: Page): Promise<void> {
  await page.addInitScript(() => { (window as any).__sepFeedsOn = true; });
}

/* The Worker faked at `base`: each call answered by `reply` (read at every call, so a spec can change its answer as it goes). */
export async function fakeWorker(page: Page, reply: (c: FeedCall) => FeedReply | Promise<FeedReply>, base = FEED_BASE): Promise<FeedCall[]> {
  const calls: FeedCall[] = [];
  await page.route(base + '/**', async (route: Route) => {
    const req = route.request(), u = new URL(req.url());
    const c: FeedCall = { url: req.url(), path: u.pathname, params: Object.fromEntries(u.searchParams.entries()), method: req.method(),
      headers: await req.allHeaders(), body: req.postData() };
    calls.push(c);
    const r = await reply(c);
    if (r.delayMs) await new Promise(res => setTimeout(res, r.delayMs));
    if (r.abort) { await route.abort('failed').catch(() => {}); return; }
    await route.fulfill({ status: r.status || 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: r.text != null ? r.text : JSON.stringify(r.json) }).catch(() => {});
  });
  return calls;
}

/* The Worker as it answers when all is well. */
export function okWorker(news: () => unknown, weather: () => unknown) {
  return (c: FeedCall): FeedReply => c.path === '/news' ? { json: news() } : c.path === '/weather' ? { json: weather() }
    : c.path === '/health' ? { json: { ok: true, at: new Date().toISOString() } } : { status: 404, json: { error: 'not found' } };
}

/* The day the specs run on: today, else (on the 1st, when no month's figures are due yet) the 2nd; 10 AM, so a forecast's
   afternoon is still ahead. The page's clock is pinned to it (setFixedTime) and every date below is built from it. */
export function testDay(): string {
  const t = todayIso();
  return t.slice(8) === '01' ? t.slice(0, 8) + '02' : t;
}
export function testTime(day = testDay(), hh = '10:00'): Date { return new Date(day + 'T' + hh + ':00'); }
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, n: number): string { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); }
/* The month before the test day: the month whose figures are due. */
export function dueMonth(day = testDay()): string {
  const d = new Date(day.slice(0, 7) + '-01T00:00:00');
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthName(m: string): string { return MONTHS[+m.slice(5, 7) - 1]; }
/* Two days in a row ahead of the test day, in one month: the days a headline says the plant shuts. */
export function shutDays(day = testDay()): [string, string] {
  for (let k = 3; k < 40; k++) {
    const a = addDays(day, k), b = addDays(day, k + 1);
    if (a.slice(0, 7) === b.slice(0, 7)) return [a, b];
  }
  throw new Error('no two days');
}

/* The news the Worker sends (§9a's shape): a month's CV figures and its exports in two headlines, the plant shut on two days, a
   model's headline in two topics (one headline, both topics), and one headline that is not safe to draw. */
export function newsAnswer(o: { month?: string; shut?: [string, string] | null; extra?: Array<Record<string, unknown>>; stale?: boolean } = {}) {
  const at = testTime().toISOString(), m = o.month || dueMonth(), name = monthName(m);
  const shut = o.shut === undefined ? shutDays() : o.shut;
  const item = (title: string, url: string, source: string) => ({ title, url, source, at, lang: 'English' });
  const plant = shut ? [item(`Tata Motors Jamshedpur plant to stay shut on ${+shut[0].slice(8)} and ${+shut[1].slice(8)} ${monthName(shut[0])} for a block closure`,
    'https://city.example.com/plant-shut', 'city.example.com')] : [];
  return {
    at, stale: o.stale === true,
    topics: {
      'tata-cv': { at, items: [
        item(`Tata Motors ${name} CV sales at 34,567 units against 32,000 units`, 'https://news.example.com/cv-sales', 'news.example.com'),
        item(`Tata Motors CV exports at 4,566 units in ${name}`, 'https://wire.example.org/exports', 'wire.example.org'),
        // Not drawn: a link that is not http(s), and a title that is all markup is drawn as its text.
        item('A headline with a script link', 'javascript:alert(1)', 'bad.example.com'),
        item('<img src=x onerror="window.__xss=1"> Tata Motors truck news', 'https://news.example.com/markup', 'news.example.com'),
        ...(o.extra || []),
      ] },
      'tata-plant': { at, items: plant },
      'tata-models': { at, items: [
        item('Tata Prima gets a new cab, the dealers say', 'https://trucks.example.net/prima', 'trucks.example.net'),
        item('Tata Signa 4825 sets a mileage record', 'https://trucks.example.net/signa', 'trucks.example.net'),
      ] },
      'tata-exports': { at, items: [item('Tata Prima gets a new cab, the dealers say', 'https://trucks.example.net/prima', 'trucks.example.net')] },
    },
    credit: { name: 'The GDELT Project', url: 'https://www.gdeltproject.org/' },
  };
}

/* The weather the Worker sends: 48 hours from the test time, thunder at 4 and 5 PM on the test day, then 7 days. */
export function weatherAnswer(o: { thunder?: number[]; stale?: boolean; days?: number } = {}) {
  const t0 = testTime(), day = testDay(), thunder = o.thunder || [16, 17];
  const hours = Array.from({ length: 48 }, (_, i) => {
    const t = new Date(t0.getTime() + i * 3600000), h = t.getHours(), storm = isoOf(t) === day && thunder.includes(h);
    return { t: t.toISOString(), temp: h >= 12 && h < 18 ? 31.4 : 26.2, symbol: storm ? 'rainshowersandthunder_day' : 'partlycloudy_day', rain: storm ? 2.5 : 0 };
  });
  const days = Array.from({ length: o.days == null ? 7 : o.days }, (_, i) => {
    const d = addDays(day, i), storm = i === 0 && thunder.length > 0;
    return { date: d, tMax: 33.2, tMin: 23.1, rain: storm ? 5 : 0, thunder: storm, symbol: storm ? 'rainshowersandthunder_day' : 'fair_day' };
  });
  return { at: t0.toISOString(), updated: t0.toISOString(), stale: o.stale === true, lat: 10.12, lon: 20.46, hours, days,
    credit: { name: 'MET Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0' } };
}

/* A book with a place for the weather (the feeds' own, or the Office QR's) and one client, nothing seeded. */
export function feedBook(o: { place?: 'feeds' | 'checkin' | 'none' } = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const place = o.place || 'feeds';
  if (place === 'feeds') s.feedsCfg = { on: true, url: FEED_BASE, lat: FAKE_LAT, lon: FAKE_LON, place: 'Test place' };
  if (place === 'checkin') s.checkinCfg = { office: '', lat: FAKE_LAT, lng: FAKE_LON, radius: 150 };
  return s;
}

/* The app loaded with the feeds on, the clock pinned to the test day, and the Worker faked. */
export async function loadWithFeeds(page: Page, s: SepState, reply = okWorker(() => newsAnswer(), () => weatherAnswer()), opts: { on?: boolean } = {}) {
  if (opts.on !== false) await feedsOn(page);
  await page.clock.setFixedTime(testTime());
  const calls = await fakeWorker(page, reply);
  await loadAppWithState(page, s);
  return calls;
}

/* What the device holds of the feeds (localStorage sep_inv_feeds). */
export async function feedCopy(page: Page): Promise<any> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_feeds') || '{}'));
}
/* Home drawn: what it asks (feedEnsure), awaited. */
export async function ensure(page: Page): Promise<unknown> {
  return page.evaluate(() => (window as any).feedEnsure());
}
export async function expectNoError(errors: string[]) { expect(errors, errors.join('\n')).toEqual([]); }
