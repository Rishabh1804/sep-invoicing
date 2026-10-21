import { test, expect, type Page } from '@playwright/test';
import { answerAsk, openSettingsAt, readStoredState } from './fixtures';
import {
  FEED_BASE, addDays, dueMonth, ensure, fakeWorker, feedBook, feedCopy, loadWithFeeds, monthName, newsAnswer, okWorker, shutDays,
  testDay, testTime, weatherAnswer, type FeedCall,
} from './feeds-fixture';

/*
 * P225 (docs/UI_PASS_3.md §9b–§9e, §16; split/feeds.js): the app's side of the world outside. The feeds Worker is faked at the
 * app's default address (feeds-fixture.ts); every headline, link and place is made up. What is held: when the app asks (Home
 * drawn and the copy over 30 minutes old, a widget's Refresh, never twice in a minute, never offline, hidden or under test); the
 * copy on the device and its age; a slow, failing or nonsense answer keeping the copy and saying so; only the topics, the
 * model words and the place to 2 decimals leaving the device; the weather days written quietly; Settings' section and its
 * Check; the Tata dialog (a month typed, a headline's figure offered and used, the calendar offered and added on a tap, the
 * models); the To-do rule mktTata; and no error on the page through any of it.
 */

const W = (page: Page) => page.evaluate.bind(page);
/* The page's clock moved on by `min` minutes from the test time. */
async function at(page: Page, min: number) { await page.clock.setFixedTime(new Date(testTime().getTime() + min * 60000)); }
function errorsOf(page: Page) { const out: string[] = []; page.on('pageerror', e => out.push(String(e))); return out; }
/* "Tue 20 and Wed 21 Oct", as the app says two days. */
function daysText(a: string, b: string) {
  const d = (iso: string) => new Date(iso + 'T00:00:00'), dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dow[d(a).getDay()]} ${d(a).getDate()} and ${dow[d(b).getDay()]} ${d(b).getDate()} ${mon[d(b).getMonth()]}`;
}

test.describe('P225: the feeds, the copy on the device and when the app asks', () => {
  test('news and weather land when Home asks: kept on the device with what was asked, read by the widgets’ functions', async ({ page }) => {
    const errors = errorsOf(page);
    const calls = await loadWithFeeds(page, feedBook());
    await ensure(page);
    expect(calls.map(c => c.path).sort()).toEqual(['/news', '/weather']);
    const copy = await feedCopy(page);
    expect(copy.news.key).toBe('topics=tata-cv,tata-plant,tata-models,tata-exports&models=Prima,Signa,Ultra,Azura');
    expect(copy.weather.key).toBe('lat=10.12&lon=20.46');
    expect(copy.news.at).toBe(testTime().getTime());
    const r = await W(page)(() => {
      const w = window as any;
      return { news: w.feedNews({ n: 10 }), signa: w.feedNews({ model: 'Signa' }), plant: w.feedNews({ topic: 'tata-plant' }), wx: w.feedWeather(),
        th: w.feedThunderToday(), age: w.feedAge('news'), viz: w.feedDayViz(), vizHtml: w.feedWeatherVizHtml() };
    });
    expect(r.news.state).toBe('ok');
    const titles = r.news.items.map((i: any) => i.title);
    // A link that is not http(s) is not drawn; a headline in two topics is one headline carrying both.
    expect(titles).not.toContain('A headline with a script link');
    expect(titles.filter((t: string) => /Prima gets a new cab/.test(t))).toHaveLength(1);
    const prima = r.news.items.find((i: any) => /Prima gets/.test(i.title));
    expect(prima.topics.sort()).toEqual(['tata-exports', 'tata-models']);
    expect(prima.models).toEqual(['Prima']);
    expect(r.news.total).toBe(6);
    expect(r.news.models).toEqual([{ word: 'Prima', n: 1 }, { word: 'Signa', n: 1 }, { word: 'Ultra', n: 0 }, { word: 'Azura', n: 0 }]);
    expect(r.news.topics.map((t: any) => [t.id, t.n])).toEqual([['tata-cv', 3], ['tata-plant', 1], ['tata-models', 2], ['tata-exports', 1]]);
    expect(r.news.credit).toEqual({ name: 'The GDELT Project', url: 'https://www.gdeltproject.org/' });
    expect(r.news.ago).toBe('from just now');
    expect([r.news.offline, r.news.stale, r.news.old, r.news.failed]).toEqual([false, false, false, '']);
    expect(r.signa.items.map((i: any) => i.title)).toEqual(['Tata Signa 4825 sets a mileage record']);
    expect(r.plant.items).toHaveLength(1);
    // The weather now, today's thunder window and the next 12 hours, on this device's clock.
    expect(r.wx.state).toBe('ok');
    expect(r.wx.now).toMatchObject({ tempText: '26°', icon: 'fair', word: 'Partly cloudy', time: '10 AM' });
    expect(r.wx.today).toMatchObject({ tMax: 33.2, tMin: 23.1, thunder: true, icon: 'storm', word: 'Thunder' });
    expect(r.wx.today.window).toMatchObject({ kind: 'thunder', from: 16, to: 18, say: 'thunder 4–6 PM' });
    expect(r.wx.hours).toHaveLength(12);
    expect(r.wx.place).toMatchObject({ lat: 10.1234, lon: 20.4567, name: 'Test place', from: 'feeds' });
    expect(r.wx.credit).toEqual({ name: 'MET Norway', url: 'https://api.met.no/', licence: 'CC BY 4.0' });
    expect(r.th).toMatchObject({ state: 'ok', date: testDay(), hours: [16, 17], say: 'thunder 4–6 PM' });
    expect(r.age).toMatchObject({ text: 'from just now', stale: false, old: false });
    expect(r.viz).toMatchObject({ icon: 'fair', temp: '26°', say: 'thunder 4–6 PM' });
    expect(r.vizHtml).toContain('data-wx-now');
    // A widget hears a copy land (the sep-feeds event): the ask's start, then its end.
    await W(page)(() => { const w = window as any; w.__heard = []; document.addEventListener('sep-feeds', (e: any) => w.__heard.push(e.detail)); });
    await at(page, 2);
    await W(page)(() => (window as any).feedRefresh('news'));
    expect(await W(page)(() => (window as any).__heard)).toEqual([{ kind: 'news', busy: true }, { kind: 'news', ok: true, why: '' }]);
    expect(errors).toEqual([]);
  });

  test('only the topics, the model words and the place to 2 decimals leave the device: nothing of the book, no cookie, no referrer', async ({ page }) => {
    const errors = errorsOf(page);
    const external: string[] = [];
    // What the page asked of anything outside it, by script (a font the page's head links is no ask of the app's).
    page.on('request', req => { const u = new URL(req.url()); if (u.hostname !== '127.0.0.1' && ['fetch', 'xhr', 'beacon', 'eventsource', 'websocket', 'other'].includes(req.resourceType())) external.push(req.url()); });
    const s: any = feedBook();
    s.clients = [{ id: 1, name: 'ZETA FORGINGS PRIVATE', billingMode: 'kg', gstType: 'intra', gstin: '20ABCDE1234F1Z5', address: 'Plot 7' }];
    s.feedsCfg.place = 'Secret Yard';
    const calls = await loadWithFeeds(page, s);
    await ensure(page);
    await at(page, 5);
    await W(page)(() => (window as any).feedCheck());
    await openSettingsAt(page, 'feeds');
    await page.locator('[data-sec="feeds"] [data-action="invFeedCheck"]').click();
    await expect(page.locator('[data-feed-check="ok"]')).toBeVisible();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    const allowed: Record<string, string[]> = { '/news': ['topics', 'models'], '/weather': ['lat', 'lon'], '/health': [] };
    const book = JSON.stringify(await readStoredState(page));
    for (const c of calls) {
      expect(c.method).toBe('GET');
      expect(c.body).toBeNull();
      expect(Object.keys(allowed)).toContain(c.path);
      for (const k of Object.keys(c.params)) expect(allowed[c.path]).toContain(k);
      expect(c.headers.cookie).toBeUndefined();
      expect(c.headers.referer).toBeUndefined();
      if (c.path === '/weather') { expect(c.params.lat).toMatch(/^-?\d+\.\d{2}$/); expect(c.params.lon).toMatch(/^-?\d+\.\d{2}$/); }
      if (c.path === '/news') {
        expect(c.params.topics.split(',').sort()).toEqual(['tata-cv', 'tata-exports', 'tata-models', 'tata-plant']);
        expect(c.params.models).toBe('Prima,Signa,Ultra,Azura');
      }
      for (const word of ['ZETA', 'FORGINGS', '20ABCDE1234F1Z5', 'SOMA', '20AAPFS4718J2Z0', 'SEP/TEST', 'Secret', 'Plot 7']) expect(c.url).not.toContain(word);
    }
    // Every ask was to the Worker: nothing else outside the app was reached (no error report either).
    expect(external.every(u => u.startsWith(FEED_BASE + '/'))).toBe(true);
    expect(book).toContain('ZETA FORGINGS PRIVATE');
    expect(errors).toEqual([]);
  });

  test('a fresh copy is not asked again, one past 30 minutes is; never twice in a minute, never offline or hidden, never under test unasked', async ({ page }) => {
    const errors = errorsOf(page);
    const calls = await loadWithFeeds(page, feedBook());
    await ensure(page);
    await ensure(page);
    expect(calls).toHaveLength(2);
    // A widget's Refresh within the minute is not asked, and says when it may be.
    const gap = await W(page)(() => (window as any).feedRefresh('news'));
    expect(gap).toMatchObject({ ok: false, why: 'gap' });
    expect(gap.wait).toBeGreaterThan(0);
    // The minute is kept on the device: a reload does not ask again either.
    await page.reload();
    await page.waitForSelector('body.inv-booted', { state: 'attached' });
    expect((await W(page)(() => (window as any).feedRefresh('weather'))).why).toBe('gap');
    expect(calls).toHaveLength(2);
    // 31 minutes on, Home asks again.
    await at(page, 31);
    await ensure(page);
    expect(calls).toHaveLength(4);
    await at(page, 33);
    // An answer says the way it came: the feeds Worker (`service`), or the sources themselves where it cannot be reached (P241).
    expect(await W(page)(() => (window as any).feedRefresh('weather'))).toEqual({ ok: true, via: 'service' });
    expect(calls).toHaveLength(5);
    // Hidden: nothing asked.
    await at(page, 80);
    await W(page)(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
    await ensure(page);
    expect(calls).toHaveLength(5);
    await W(page)(() => { delete (document as any).hidden; });
    // Offline: nothing asked; the copy is shown with its age and the widget says it is offline.
    await page.context().setOffline(true);
    await ensure(page);
    expect(calls).toHaveLength(5);
    const off = await W(page)(() => { const w = window as any; return { n: w.feedNews(), wx: w.feedWeather() }; });
    expect(off.n).toMatchObject({ state: 'ok', offline: true, old: true, ago: 'from 1 h ago' });
    expect(off.wx).toMatchObject({ state: 'ok', offline: true });
    expect(await W(page)(() => (window as any).feedRefresh('news'))).toEqual({ ok: false, why: 'offline' });
    await page.context().setOffline(false);
    expect(errors).toEqual([]);
  });

  test('under test the feeds stay quiet unless a spec turns them on, and say so', async ({ page }) => {
    const errors = errorsOf(page);
    const calls = await loadWithFeeds(page, feedBook(), okWorker(() => newsAnswer(), () => weatherAnswer()), { on: false });
    await ensure(page);
    expect(calls).toHaveLength(0);
    const r = await W(page)(() => { const w = window as any; return { n: w.feedNews(), wx: w.feedWeather(), viz: w.feedDayViz(), html: w.feedWeatherVizHtml() }; });
    expect(r.n.state).toBe('offline');
    expect(r.n.blank).toMatchObject({ kind: 'offline', title: 'The news is not fetched in this browser' });
    expect(r.wx.blank.title).toBe('The weather is not fetched in this browser');
    // The day card draws nothing at all where there is no weather: no placeholder.
    expect(r.viz).toBeNull();
    expect(r.html).toBe('');
    expect(errors).toEqual([]);
  });

  test('a failing, slow or nonsense answer keeps the copy and says why; never reached, the feed is not set up yet', async ({ page }) => {
    const errors = errorsOf(page);
    let mode = '500';
    const calls = await loadWithFeeds(page, feedBook(), (c: FeedCall) => {
      if (mode === 'ok') return okWorker(() => newsAnswer(), () => weatherAnswer())(c);
      if (mode === 'stale') return okWorker(() => newsAnswer({ stale: true }), () => weatherAnswer({ stale: true }))(c);
      if (mode === '500') return { status: 500, json: { error: 'upstream' } };
      if (mode === 'html') return { text: '<html><body>Not the Worker</body></html>' };
      if (mode === 'shape') return { json: { hello: 'world' } };
      if (mode === 'slow') return { delayMs: 1500, json: newsAnswer() };
      return { abort: true };
    });
    // Home asked when it was drawn (awaited here), and its minute's ask is stopped so that each ask below is this spec's own.
    await ensure(page);
    await W(page)(() => (window as any).homeClockStop());
    // Never reached from this device: not set up yet, with the guide's door.
    let n = await W(page)(() => (window as any).feedNews());
    expect(n.state).toBe('notset');
    expect(n.blank.title).toBe('The news is not set up yet');
    expect(n.blank.body).toContain('The feeds Worker answered 500');
    expect(n.blank.action).toContain('data-action="invFeedGuide"');
    // Asked again within the minute: not asked; after it, refused again.
    expect(await W(page)(() => (window as any).feedRefresh('news'))).toMatchObject({ ok: false, why: 'gap' });
    await at(page, 2);
    // Under test the sources are never asked in its place unless a spec says so (P241): the Worker's refusal stands.
    expect(await W(page)(() => (window as any).feedRefresh('news'))).toEqual({ ok: false, why: 'refused', status: 500, via: 'service' });
    // It lands once: from then on a failure keeps the copy.
    mode = 'ok'; await at(page, 4);
    expect(await W(page)(() => (window as any).feedRefresh())).toEqual([{ ok: true, via: 'service' }, { ok: true, via: 'service' }]);
    const kept = (await feedCopy(page)).news.data;
    await W(page)(() => { (window as any).FEED_TIMEOUT_MS = 300; });
    const cases: Array<[string, string, string]> = [['html', 'nonsense', 'the answer was not the feeds Worker’s'], ['shape', 'nonsense', 'the answer was not the feeds Worker’s'],
      ['slow', 'slow', 'no answer in 8 seconds'], ['abort', 'unreachable', 'the feeds Worker could not be reached'], ['500', 'refused', 'the feeds Worker answered 500']];
    let t = 4;
    for (const [m, why, said] of cases) {
      mode = m; t += 2; await at(page, t);
      const r = await W(page)(() => (window as any).feedRefresh('news'));
      expect(r.ok, m).toBe(false);
      expect(r.why, m).toBe(why);
      const copy = await feedCopy(page);
      expect(copy.news.data, m).toEqual(kept);
      expect(copy.news.why, m).toBe(why);
      n = await W(page)(() => (window as any).feedNews());
      expect(n.state, m).toBe('ok');
      expect(n.total, m).toBe(6);
      expect(n.failed, m).toBe(said);
    }
    // The Worker's own upstream failed: its last copy, said as such.
    mode = 'stale'; t += 2; await at(page, t);
    await W(page)(() => (window as any).feedRefresh());
    n = await W(page)(() => (window as any).feedNews());
    expect(n).toMatchObject({ state: 'ok', stale: true });
    expect((await W(page)(() => (window as any).feedAge('weather'))).stale).toBe(true);
    // A weather copy with no hour now (two days old) is too old to show.
    await page.clock.setFixedTime(new Date(testTime().getTime() + 50 * 3600000));
    const wx = await W(page)(() => (window as any).feedWeather());
    expect(wx.state).toBe('offline');
    expect(wx.blank.title).toMatch(/could not be fetched|too old/);
    expect(calls.length).toBeGreaterThan(8);
    expect(errors).toEqual([]);
  });

  test('the plant’s place: none set, the weather is not set; the Office QR’s is used and never copied; another place’s copy is not shown', async ({ page }) => {
    const errors = errorsOf(page);
    let calls = await loadWithFeeds(page, feedBook({ place: 'none' }));
    await ensure(page);
    expect(calls.map(c => c.path)).toEqual(['/news']);
    const ns = await W(page)(() => (window as any).feedWeather());
    expect(ns.state).toBe('notset');
    expect(ns.blank.title).toBe('Set the plant’s place');
    expect(ns.blank.action).toContain('data-action="invFeedSettings"');
    expect((await W(page)(() => (window as any).feedThunderToday())).state).toBe('notset');

    calls = [];
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    calls = await fakeWorker(page, okWorker(() => newsAnswer(), () => weatherAnswer()));
    await W(page)(() => localStorage.removeItem('sep_inv_feeds'));
    await page.evaluate(() => { const w = window as any; (0, eval)('S').checkinCfg = { lat: 10.1234, lng: 20.4567, radius: 150 }; w.saveState(); });
    await ensure(page);
    expect(calls.find(c => c.path === '/weather')!.params).toEqual({ lat: '10.12', lon: '20.46' });
    const wx = await W(page)(() => (window as any).feedWeather());
    expect(wx.place).toMatchObject({ lat: 10.1234, lon: 20.4567, from: 'checkin' });
    expect((await readStoredState(page)).feedsCfg).toMatchObject({ lat: null, lon: null });
    // A copy asked for another place is not this plant's weather.
    await page.evaluate(() => { const w = window as any; (0, eval)('S').checkinCfg.lat = 11.5; });
    const other = await W(page)(() => (window as any).feedWeather());
    expect(other.state).not.toBe('ok');
    expect(errors).toEqual([]);
  });

  test('the weather days are written quietly: today’s forecast widest, 400 days kept, no change-log row, the merge holds nothing', async ({ page }) => {
    const errors = errorsOf(page);
    const day = testDay(), s: any = feedBook();
    s.market = { tata: {}, calendar: {}, models: ['Prima'], weather: {
      [addDays(day, -401)]: { tMax: 30, tMin: 20, rain: 0, thunder: false, symbol: 'fair_day', at: 1 },
      [addDays(day, -10)]: { tMax: 31, tMin: 21, rain: 1, thunder: false, symbol: 'rain', at: 2 } } };
    let wx = weatherAnswer();
    await loadWithFeeds(page, s, okWorker(() => newsAnswer(), () => wx));
    const logBefore = await W(page)(() => (0, eval)('S').changeLog.length);
    await ensure(page);
    await expect.poll(async () => (await readStoredState(page)).market?.weather?.[day]?.thunder).toBe(true);
    let st = await readStoredState(page);
    expect(st.market.weather[day]).toEqual({ tMax: 33.2, tMin: 23.1, rain: 5, thunder: true, symbol: 'rainshowersandthunder_day', at: testTime().getTime() });
    expect(st.market.weather[addDays(day, -401)]).toBeUndefined();
    expect(st.market.weather[addDays(day, -10)]).toBeTruthy();
    // A later forecast with less in it never takes away what the day was forecast (a forecast at 6 PM lacks the afternoon).
    wx = weatherAnswer({ thunder: [] });
    (wx.days[0] as any).tMax = 35;
    await at(page, 40);
    await W(page)(() => (window as any).feedRefresh('weather'));
    await expect.poll(async () => (await readStoredState(page)).market.weather[day].tMax).toBe(35);
    st = await readStoredState(page);
    expect(st.market.weather[day]).toMatchObject({ tMax: 35, tMin: 23.1, rain: 5, thunder: true });
    // Never compared: no row, and a save of something else adds none for it either.
    const log = await W(page)(() => { const w = window as any; (0, eval)('S').feedsCfg.place = 'Moved'; w.saveState(); return (0, eval)('S').changeLog; });
    expect(log.filter((e: any) => e.coll === 'market.weather')).toEqual([]);
    expect(log.length).toBe(logBefore + 1);
    expect(log[log.length - 1]).toMatchObject({ coll: 'feedsCfg', op: 'change' });
    // The merge: this device's days, the other's filling what it lacks, never held; Tata's months by field, their stamps quiet.
    const m = await W(page)(() => {
      const w = window as any, A = { tMax: 1, at: 1 }, B = { tMax: 2, at: 2 }, C = { tMax: 3, at: 3 };
      const tm = (now: number, stamp: number) => ({ cvTotal: { now, ly: null }, hcv: { now: null, ly: null }, at: stamp, by: 'Someone' });
      const book = (weather: any, tata: any, models: string[]) => ({ market: { weather, tata, calendar: {}, models }, changeLog: [], users: [] });
      const r1 = w.mrgMerge(book({}, { '2026-09': tm(1, 1) }, ['Prima']), book({ d1: A }, { '2026-09': tm(1, 5) }, ['Prima', 'Signa']),
        book({ d1: B, d2: C }, { '2026-09': tm(2, 6) }, ['Prima']));
      const r2 = w.mrgMerge(book({}, { '2026-09': tm(1, 1) }, ['Prima']), book({}, { '2026-09': tm(3, 5) }, ['Ultra']), book({}, { '2026-09': tm(4, 6) }, ['Azura']));
      return { w1: r1.book.market.weather, t1: r1.book.market.tata['2026-09'], m1: r1.book.market.models, held1: r1.held,
        held2: r2.held.map((h: any) => [h.coll, h.rid, h.field]) };
    });
    expect(m.w1).toEqual({ d1: { tMax: 1, at: 1 }, d2: { tMax: 3, at: 3 } });
    expect(m.t1.cvTotal).toEqual({ now: 2, ly: null });
    expect(m.t1.at).toBe(5);
    expect(m.m1).toEqual(['Prima', 'Signa']);
    expect(m.held1).toEqual([]);
    expect(m.held2.sort()).toEqual([['market.models', null, null], ['market.tata', '2026-09', 'cvTotal']].sort());
    expect(errors).toEqual([]);
  });
});

test.describe('P225: Settings → Connections → News and weather', () => {
  test('on by default at the Worker’s address, the place prefilled from the Office QR, Check says what came back, the credits and the guide', async ({ page }) => {
    const errors = errorsOf(page);
    let health: 'ok' | '404' | 'abort' | 'nonsense' = 'ok';
    const calls = await loadWithFeeds(page, feedBook({ place: 'checkin' }), (c: FeedCall) => {
      if (c.path !== '/health') return okWorker(() => newsAnswer(), () => weatherAnswer())(c);
      return health === 'ok' ? { json: { ok: true, at: testTime().toISOString() } } : health === '404' ? { status: 404, json: { error: 'no' } }
        : health === 'nonsense' ? { json: { hello: 1 } } : { abort: true };
    });
    await openSettingsAt(page, 'feeds');
    const sec = page.locator('details[data-sec="feeds"]');
    await expect(sec.locator(':scope > summary')).toContainText('News and weather');
    await expect(page.locator('[data-sum="feeds"]')).toHaveText('feeds.somaelectro.co.in · the plant at 10.12, 20.46');
    await expect(page.locator('#setFeedOn')).toBeChecked();
    await expect(page.locator('#setFeedUrl')).toHaveValue(FEED_BASE);
    await expect(page.locator('#setFeedLat')).toHaveValue('10.1234');
    await expect(page.locator('#setFeedLon')).toHaveValue('20.4567');
    await expect(sec).toContainText('The place is the Office QR’s, until another is typed here.');
    await expect(sec).toContainText('The GDELT Project');
    await expect(sec).toContainText('MET Norway');
    await expect(sec).toContainText('CC BY 4.0');
    await expect(sec.locator('a[href="https://www.gdeltproject.org/"]')).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(sec).toContainText('ALLOWED_ORIGINS');
    // Check: reached, refused, nonsense, not reachable, offline, not an address the app asks.
    const check = page.locator('[data-sec="feeds"] [data-action="invFeedCheck"]'), out = page.locator('[data-feed-check]');
    await check.click();
    await expect(out).toHaveAttribute('data-feed-check', 'ok');
    await expect(out.locator('.inv-dot.inv-dot-ok')).toHaveText('Reached');
    await expect(out).toContainText('the feeds Worker answered');
    health = '404'; await check.click();
    await expect(out).toHaveAttribute('data-feed-check', 'danger');
    await expect(out).toHaveText('Refused: the address answered 404. Check the address and the Worker’s settings.');
    health = 'nonsense'; await check.click();
    await expect(out).toHaveAttribute('data-feed-check', 'warning');
    await expect(out).toContainText('not as the feeds Worker does');
    health = 'abort'; await check.click();
    await expect(out).toHaveAttribute('data-feed-check', 'danger');
    await expect(out).toContainText('Not reachable');
    await expect(out).toContainText('ALLOWED_ORIGINS');
    const asked = calls.length;
    await page.locator('#setFeedUrl').fill('http://feeds.example.com');
    await check.click();
    await expect(out).toContainText('Not an address the app asks');
    await page.context().setOffline(true);
    await page.locator('#setFeedUrl').fill(FEED_BASE);
    await check.click();
    await expect(out).toHaveText('This device is offline: nothing was asked.');
    await page.context().setOffline(false);
    expect(calls.length).toBe(asked);
    // Another address typed is the one asked.
    const other = await fakeWorker(page, () => ({ json: { ok: true, at: testTime().toISOString() } }), 'https://feeds-two.example.com');
    await page.locator('#setFeedUrl').fill('https://feeds-two.example.com/');
    health = 'ok'; await check.click();
    await expect(out).toHaveAttribute('data-feed-check', 'ok');
    expect(other.map(c => c.path)).toEqual(['/health']);
    // Save: one coordinate alone is refused; the Office QR's place left as it is stays the QR's (never copied); a blank address
    // is the default.
    await page.locator('#setFeedLat').fill('');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="feeds"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Type both the latitude and the longitude');
    await page.locator('#setFeedLat').fill('10.1234');
    await page.locator('#setFeedUrl').fill('');
    await page.locator('#setFeedPlace').fill('Works');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="feeds"]').click();
    await expect(page.locator('[data-sum="feeds"]')).toHaveText('feeds.somaelectro.co.in · Works at 10.12, 20.46');
    expect((await readStoredState(page)).feedsCfg).toEqual({ on: true, url: FEED_BASE, lat: null, lon: null, place: 'Works' });
    // A place of its own is the feeds' own.
    await page.locator('#setFeedLat').fill('11.5');
    await page.locator('#setFeedLon').fill('21.25');
    await page.locator('#setFeedOn').uncheck();
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="feeds"]').click();
    await expect(page.locator('[data-sum="feeds"]')).toHaveText('off');
    expect((await readStoredState(page)).feedsCfg).toMatchObject({ on: false, lat: 11.5, lon: 21.25 });
    // Off: nothing asked, and the widgets say so with Settings' door.
    const before = calls.length + other.length;
    await at(page, 60);
    await ensure(page);
    expect(calls.length + other.length).toBe(before);
    const n = await W(page)(() => (window as any).feedNews());
    expect(n.blank).toMatchObject({ kind: 'notset', title: 'News and weather are switched off' });
    expect(n.blank.action).toContain('invFeedSettings');
    // The change log names the section.
    const log = await W(page)(() => (0, eval)('S').changeLog.filter((e: any) => e.coll === 'feedsCfg'));
    expect(log.length).toBeGreaterThan(0);
    expect(log[log.length - 1].label).toBe('Settings → News and weather');
    expect(errors).toEqual([]);
  });

  test('its guide: Setting up: the news and weather, in the knowledge base, naming nothing of the shop', async ({ page }) => {
    const errors = errorsOf(page);
    await loadWithFeeds(page, feedBook());
    const g = await W(page)(() => (window as any).KB_APP_GUIDES.find((a: any) => a.id === 'app-feeds'));
    expect(g).toMatchObject({ kind: 'guide', src: 'build', title: 'Setting up: the news and weather', roles: [] });
    for (const step of ['Workers & Pages → Create → Import a repository', 'server/feeds', 'ALLOWED_ORIGINS', 'CONTACT', 'Custom domain', '**Check**', 'GDELT', 'MET Norway', 'CC BY 4.0'])
      expect(g.body).toContain(step);
    expect(g.body).not.toMatch(/\d+\.\d+\.\d+\.\d+|github\.com\/|rishabh|somaelectro|@/i);
    await openSettingsAt(page, 'feeds');
    const link = page.locator('[data-sec="feeds"] [data-action="invSettingsGuide"][data-id="app-feeds"]');
    await expect(link).toHaveText('Guide: Setting up: the news and weather');
    await link.click();
    await expect(page.locator('#settingsScrim')).toHaveCount(0);
    await expect(page.locator('#pageKnow')).toBeVisible();
    expect(await W(page)(() => new URL(location.href).searchParams.get('id'))).toBe('app-feeds');
    // A widget's blank state opens it too (its door, feedGo).
    await page.evaluate(() => (window as any).feedGo('settings'));
    await expect(page.locator('details[data-sec="feeds"][open]')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('P225: what a headline is read as (offered, never applied)', () => {
  test('a month’s figures by their segment and year, the plant’s days by their words and weekday; nothing it cannot read surely', async ({ page }) => {
    const errors = errorsOf(page);
    await loadWithFeeds(page, feedBook());
    const m = dueMonth(), name = monthName(m), y = +m.slice(0, 4);
    const figs = await W(page)(([titles, month, at]) => (titles as string[]).map(t => (window as any).mktHeadFigures({ title: t, url: 'https://x.example.com/a', source: 'x.example.com', at, topics: ['tata-cv'] }, month)
      .map((o: any) => [o.field, o.which, o.value])), [[
      `Tata Motors ${name} CV sales rise 7% to 34,567 units`,
      `Tata Motors' domestic CV sales at 30,001 units in ${name}, exports 4,566 units`,
      `Tata Motors M&HCV sales at 12,050 units in ${name}`,
      `Tata Motors sells 34,567 CVs in ${name}`,
      `Tata Motors CV sales at 34,567 units in ${name} ${y} against 32,000 units in ${name} ${y - 1}`,
      `Tata Motors total sales at 81,000 units in ${name}`,
      `Tata Motors passenger vehicle sales at 45,000 units in ${name}`,
      `Tata Motors CV sales in ${name} ${y - 1} were 32,000 units`,
    ], m, testTime().toISOString()] as const);
    expect(figs).toEqual([
      [['cvTotal', 'now', 34567]],
      [['cvDomestic', 'now', 30001], ['cvExport', 'now', 4566]],
      [['hcv', 'now', 12050]],
      [['cvTotal', 'now', 34567]],
      [['cvTotal', 'now', 34567], ['cvTotal', 'ly', 32000]],
      // All the sales (cars too), a car's, and another year's month: nothing.
      [], [], [],
    ]);
    // The plant's days: two in a row, one, "for two days", a Sunday worked; its weekday disagreeing, or the plant not shut, nothing.
    const [d1, d2] = shutDays(), sunday = (() => { let d = addDays(testDay(), 1); while (new Date(d + 'T00:00:00').getDay() !== 0) d = addDays(d, 1); return d; })();
    const dm = (d: string) => `${+d.slice(8)} ${monthName(d.slice(0, 7))}`, md = (d: string) => `${monthName(d.slice(0, 7))} ${+d.slice(8)}`;
    const days = await W(page)(([titles, at]) => (titles as string[]).map(t => (window as any).mktHeadDays({ title: t, at, topics: ['tata-plant'] })), [[
      `Tata Motors Jamshedpur plant to stay shut on ${+d1.slice(8)} and ${dm(d2)} for a block closure`,
      `Tata Motors Jamshedpur block closure on ${md(d1)}`,
      `Tata Motors Jamshedpur plant shut for two days from ${md(d1)}`,
      `Tata Motors Jamshedpur plant to work on Sunday, ${md(sunday)}, to meet demand`,
      // "Sunday" on a day that is a Monday: the weekday disagrees with the date.
      `Tata Motors Jamshedpur plant to work on Sunday, ${md(addDays(sunday, 1))}`,
      `Tata Motors Jamshedpur production resumes after the closure on ${md(d1)}`,
      `Tata Motors Jamshedpur: no closure, works as usual on ${dm(d1)}`,
    ], testTime().toISOString()] as const);
    expect(days).toEqual([
      { state: 'shut', dates: [d1, d2] },
      { state: 'shut', dates: [d1] },
      { state: 'shut', dates: [d1, addDays(d1, 1)] },
      { state: 'works', dates: [sunday] },
      null, null, null,
    ]);
    expect(errors).toEqual([]);
  });
});

test.describe('P225: the Tata dialog and the To-do rule mktTata', () => {
  test('a month typed and saved, typed again replaces it and the change log keeps the old; a headline’s figure offered and used', async ({ page }) => {
    const errors = errorsOf(page);
    await loadWithFeeds(page, feedBook());
    await ensure(page);
    const m = dueMonth(), name = monthName(m);
    await page.evaluate(() => (window as any).mktTataOpen());
    const dlg = page.locator('[data-mkt-tata]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.inv-dialog-title')).toHaveText('Tata Motors, Jamshedpur');
    await expect(page.locator('#mktMonth')).toHaveValue(m);
    // The headlines' figures for the month, offered, never applied.
    const offers = dlg.locator('[data-mkt-offers] [data-mkt-offer]');
    await expect(offers).toHaveText([
      new RegExp(`A headline says 34,567 CVs in ${name}`), new RegExp(`A headline says 32,000 CVs in ${name} a year before`), new RegExp(`A headline says 4,566 CV exports in ${name}`)]);
    await expect(offers.first().locator('a')).toHaveAttribute('href', 'https://news.example.com/cv-sales');
    await expect(offers.first().locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
    await offers.nth(0).getByRole('button', { name: 'Use' }).click();
    await offers.nth(1).getByRole('button', { name: 'Use' }).click();
    await expect(page.locator('#mktF_cvTotal_now')).toHaveValue('34567');
    await expect(page.locator('#mktF_cvTotal_ly')).toHaveValue('32000');
    expect(await W(page)(m0 => (0, eval)('S').market.tata[m0], m)).toBeUndefined();
    // A figure is a whole number of units; a blank stays blank.
    await page.locator('#mktF_hcv_now').fill('12,050');
    await page.locator('#mktF_cvExport_now').fill('4.5');
    await dlg.getByRole('button', { name: `Save ${name}` }).click();
    await expect(page.locator('.inv-toast').last()).toContainText('CV exports: a figure is a whole number of units');
    await page.locator('#mktF_cvExport_now').fill('');
    await page.locator('#mktRel').fill(testDay());
    await page.locator('#mktUrl').fill('https://release.example.com/sales');
    await dlg.getByRole('button', { name: `Save ${name}` }).click();
    await expect(page.locator('.inv-toast').last()).toContainText(`${name} ${m.slice(0, 4)}’s figures saved`);
    let t = (await readStoredState(page)).market.tata[m];
    expect(t).toMatchObject({ released: testDay(), url: 'https://release.example.com/sales', note: '', cvTotal: { now: 34567, ly: 32000 }, cvDomestic: { now: null, ly: null },
      cvExport: { now: null, ly: null }, hcv: { now: 12050, ly: null }, at: testTime().getTime() });
    // Read back as the widgets read it.
    const latest = await W(page)(() => (window as any).mktTataLatest());
    expect(latest).toMatchObject({ state: 'ok', month: m, label: `${name} ${m.slice(0, 4)}`, due: null });
    expect(latest.figs[0]).toMatchObject({ key: 'cvTotal', now: 34567, ly: 32000, pct: 8, dir: 'up', tone: 'ok', say: '+8.0% on last year' });
    expect(latest.figs[3]).toMatchObject({ key: 'hcv', now: 12050, ly: null, pct: null, say: '' });
    const months = await W(page)(() => (window as any).mktTataMonths('cvTotal', 13));
    expect(months.rows).toHaveLength(13);
    expect(months.rows[12]).toMatchObject({ month: m, now: 34567, ly: 32000 });
    expect(months.rows[0]).toMatchObject({ now: null, ly: null });
    // Typed again five minutes on: replaced, the change log keeping what it was.
    await at(page, 5);
    await page.locator('#mktF_cvTotal_now').fill('34600');
    await dlg.getByRole('button', { name: `Save ${name}` }).click();
    t = (await readStoredState(page)).market.tata[m];
    expect(t.cvTotal).toEqual({ now: 34600, ly: 32000 });
    const log = (await readStoredState(page)).changeLog.filter((e: any) => e.coll === 'market.tata');
    expect(log.map((e: any) => [e.op, e.rid, e.label])).toEqual([['add', m, `${name} ${m.slice(0, 4)}`], ['change', m, `${name} ${m.slice(0, 4)}`]]);
    expect(log[1].fields).toEqual([{ f: 'cvTotal.now', from: 34567, to: 34600 }]);
    // History reads the field by its name.
    expect(await W(page)(e => (window as any).chgText(e), log[1])).toContain('all CVs 34567 → 34600');
    // The month is listed as typed.
    await expect(dlg.locator('[data-mkt-months] button[data-month="' + m + '"]')).toContainText(`${name} ${m.slice(0, 4)}`);
    expect(errors).toEqual([]);
  });

  test('the plant’s calendar: its week, a headline’s days offered and added only on a tap, a day typed and removed; the models followed', async ({ page }) => {
    const errors = errorsOf(page);
    const calls = await loadWithFeeds(page, feedBook());
    await ensure(page);
    const [d1, d2] = shutDays();
    await page.evaluate(() => (window as any).mktTataOpen());
    const dlg = page.locator('[data-mkt-tata]');
    const week = dlg.locator('[data-mkt-week] .inv-mkt-day');
    await expect(week).toHaveCount(7);
    await expect(week.first()).toHaveAttribute('data-day', testDay());
    // A Sunday reads shut, plain; that it is only usually shut is its title's.
    const sunday = await week.evaluateAll(els => els.filter(e => /usually shut/.test(e.getAttribute('title') || '')).map(e => e.querySelector('.inv-mkt-day-s')!.textContent));
    expect(sunday).toEqual(['shut']);
    const offer = dlg.locator('[data-mkt-caloffer]');
    await expect(offer).toHaveCount(1);
    await expect(offer.locator('.inv-row-title')).toHaveText(`Add to the calendar: ${daysText(d1, d2)} shut`);
    await expect(offer.locator('.inv-row-meta a')).toHaveText('city.example.com');
    const said = await W(page)(() => (window as any).mktOffers().calendar[0].said);
    expect(said.startsWith(`Add to the calendar: ${daysText(d1, d2)} shut (city.example.com, `)).toBe(true);
    expect(await W(page)(() => (0, eval)('S').market.calendar)).toEqual({});
    await offer.getByRole('button', { name: 'Add' }).click();
    const cal = (await readStoredState(page)).market.calendar;
    expect(Object.keys(cal).sort()).toEqual([d1, d2]);
    expect(cal[d1]).toMatchObject({ state: 'shut', src: 'news', url: 'https://city.example.com/plant-shut' });
    expect(cal[d1].why).toContain('block closure');
    await expect(offer).toHaveCount(0);
    await expect(dlg.locator(`[data-mkt-week] [data-day="${d1}"]`)).toHaveAttribute('data-tone', 'warning');
    await expect(dlg.locator(`[data-mkt-calday="${d2}"]`)).toContainText('shut');
    const pw = await W(page)(() => (window as any).mktPlantWeek());
    expect(pw.entries).toBe(2);
    expect(pw.days.find((d: any) => d.date === d1)).toMatchObject({ state: 'shut', usual: false, word: 'shut', tone: 'warning', src: 'news' });
    // A day typed: the plant works tomorrow, from Tata's circular (a holiday worked).
    const sun = pw.days[1].date;
    await page.locator('#mktCalDate').fill(sun);
    await page.locator('#mktCalState').selectOption('works');
    await page.locator('#mktCalWhy').fill('A holiday worked');
    await dlg.getByRole('button', { name: 'Add the day' }).click();
    expect((await readStoredState(page)).market.calendar[sun]).toMatchObject({ state: 'works', src: 'circular', why: 'A holiday worked' });
    await expect(dlg.locator(`[data-mkt-week] [data-day="${sun}"]`)).toHaveAttribute('data-tone', 'info');
    await dlg.locator(`[data-action="invMktCalDel"][data-date="${d2}"]`).click();
    expect(Object.keys((await readStoredState(page)).market.calendar).sort()).toEqual([d1, sun].sort());
    const calLog = (await readStoredState(page)).changeLog.filter((e: any) => e.coll === 'market.calendar');
    expect(calLog.map((e: any) => e.op)).toEqual(['add', 'add', 'add', 'remove']);
    // The models: the chips filter the headlines; a model followed is sent at the next ask; a word the Worker refuses is refused here.
    const chips = dlg.locator('[data-mkt-filter] [data-action="invMktChip"]');
    await expect(chips).toHaveText([/All/, /Prima\s*1/, /Signa\s*1/, /Ultra\s*0/, /Azura\s*0/]);
    await chips.filter({ hasText: 'Signa' }).click();
    await expect(chips.filter({ hasText: 'Signa' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.locator('[data-mkt-news] [data-feed-item]')).toHaveCount(1);
    await page.locator('#mktModelNew').fill('Winger');
    await dlg.getByRole('button', { name: 'Follow', exact: true }).click();
    expect((await readStoredState(page)).market.models).toEqual(['Prima', 'Signa', 'Ultra', 'Azura', 'Winger']);
    await page.locator('#mktModelNew').fill('<b>');
    await page.locator('#mktModelNew').press('Enter');
    await expect(page.locator('.inv-toast').last()).toContainText('A model is letters, digits, spaces and dots');
    await dlg.locator('[data-action="invMktModelDel"][data-word="Azura"]').click();
    expect((await readStoredState(page)).market.models).toEqual(['Prima', 'Signa', 'Ultra', 'Winger']);
    const mLog = (await readStoredState(page)).changeLog.filter((e: any) => e.coll === 'market.models');
    expect(mLog[mLog.length - 1]).toMatchObject({ op: 'change', label: 'Tata Motors → the models followed', fields: [{ f: 'models', from: 'Prima, Signa, Ultra, Azura, Winger', to: 'Prima, Signa, Ultra, Winger' }] });
    await at(page, 3);
    await W(page)(() => (window as any).feedRefresh('news'));
    expect(calls[calls.length - 1].params.models).toBe('Prima,Signa,Ultra,Winger');
    // Every headline drawn as text, its link out http(s) only, in a new tab with no opener.
    await chips.filter({ hasText: 'All' }).click();
    const links = dlg.locator('[data-mkt-news] a[data-feed-item]');
    await expect(links).toHaveCount(6);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(a).toHaveAttribute('target', '_blank');
      expect(await a.getAttribute('href')).toMatch(/^https:\/\//);
    }
    await expect(dlg.locator('[data-mkt-news]')).toContainText('<img src=x onerror="window.__xss=1"> Tata Motors truck news');
    expect(await W(page)(() => (window as any).__xss)).toBeUndefined();
    await expect(dlg.locator('[data-mkt-news]')).toContainText('The GDELT Project');
    expect(errors).toEqual([]);
  });

  test('the dialog asks before typed work goes, once; a month switched asks too; an ID that may not change Settings reads it only', async ({ page }) => {
    const errors = errorsOf(page);
    await loadWithFeeds(page, feedBook());
    await page.evaluate(() => (window as any).mktTataOpen());
    const dlg = page.locator('[data-mkt-tata]'), m = dueMonth();
    // Typed and cleared again: nothing to ask.
    await page.locator('#mktF_cvDomestic_now').fill('5');
    await page.locator('#mktF_cvDomestic_now').fill('');
    await dlg.locator('.inv-dialog-foot').getByRole('button', { name: 'Close' }).click();
    await expect(dlg).toHaveCount(0);
    // Typed: Close asks, Keep editing stays; the × asks once and Discard shuts it.
    await page.evaluate(() => (window as any).mktTataOpen());
    await page.locator('#mktF_cvDomestic_now').fill('5');
    await dlg.locator('.inv-dialog-foot').getByRole('button', { name: 'Close' }).click();
    expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#mktF_cvDomestic_now')).toHaveValue('5');
    // Another month while typed: asked, and Keep editing leaves the month as it was.
    const other = await page.locator('#mktMonth option').nth(2).getAttribute('value');
    await page.locator('#mktMonth').selectOption(other!);
    expect(await answerAsk(page, 'cancel')).toContain('Discard what you typed?');
    await expect(page.locator('#mktMonth')).toHaveValue(m);
    await dlg.locator('.inv-dialog-close').click();
    await answerAsk(page, 'ok');
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    await expect(dlg).toHaveCount(0);
    // Not typed: another month opens on its own figures at once.
    await page.evaluate(() => (window as any).mktTataOpen());
    await page.locator('#mktMonth').selectOption(other!);
    await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
    await expect(dlg.locator('[data-action="invMktSave"]')).toHaveText(`Save ${monthName(other!)}`);
    await dlg.locator('.inv-dialog-close').click();
    await expect(dlg).toHaveCount(0);
    // An ID that may not change Settings reads the dialog only: no Save, no Use, no Add, every field shut.
    await page.evaluate(() => { const w = window as any; w.grdCan = () => false; w.mktTataOpen(); });
    await expect(dlg.locator('[data-action="invMktSave"]')).toHaveCount(0);
    await expect(dlg).toContainText('Only an ID that may change Settings types these');
    await expect(page.locator('#mktF_cvTotal_now')).toBeDisabled();
    await expect(dlg.locator('[data-action="invMktUse"], [data-action="invMktCalOffer"], [data-action="invMktModelAdd"], [data-action="invMktCalAdd"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('mktTata: from the 2nd, until the month before is typed; its move opens the dialog on it; the owner’s, switchable', async ({ page }) => {
    const errors = errorsOf(page);
    await loadWithFeeds(page, feedBook());
    await ensure(page);
    const m = dueMonth(), name = monthName(m);
    const task = await W(page)(() => (window as any).todoAppAll().find((t: any) => t.rule === 'mktTata'));
    expect(task).toMatchObject({ key: 'mktTata:' + m, rule: 'mktTata', tone: 'info', title: `Type ${name}’s Tata figures`, sig: m, go: { kind: 'mktTata', month: m } });
    expect(task.facts).toContainEqual(['A headline says', `34,567 CVs in ${name}`]);
    expect(await W(page)(() => [(window as any).TODO_RULE_NEED.mktTata, (window as any).TODO_CHECK_DEFAULTS.mktTata])).toEqual(['owner', true]);
    expect(await W(page)(() => (window as any).TODO_RULES.some((r: any) => r[0] === 'mktTata'))).toBe(true);
    // Its move: the dialog on that month.
    await page.evaluate(go => (window as any).todoGo(go), task.go);
    await expect(page.locator('[data-mkt-tata]')).toBeVisible();
    await expect(page.locator('#mktMonth')).toHaveValue(m);
    await page.locator('#mktF_hcv_now').fill('12050');
    await page.locator('[data-mkt-tata] [data-action="invMktSave"]').click();
    expect(await W(page)(() => (window as any).todoAppAll().filter((t: any) => t.rule === 'mktTata'))).toEqual([]);
    // On the 1st nothing is due yet.
    await page.evaluate(() => { const w = window as any; delete (0, eval)('S').market.tata[Object.keys((0, eval)('S').market.tata)[0]]; });
    expect(await W(page)(() => (window as any).todoAppAll().filter((t: any) => t.rule === 'mktTata').length)).toBe(1);
    await page.clock.setFixedTime(new Date(testDay().slice(0, 8) + '01T10:00:00'));
    expect(await W(page)(() => (window as any).todoAppAll().filter((t: any) => t.rule === 'mktTata').length)).toBe(0);
    await page.clock.setFixedTime(testTime());
    // Switched off in Settings → Checks & alerts → To-do.
    await page.evaluate(() => { (0, eval)('S').todoCheck.mktTata = false; });
    expect(await W(page)(() => (window as any).todoAppAll().filter((t: any) => t.rule === 'mktTata').length)).toBe(0);
    expect(errors).toEqual([]);
  });
});
