import { test, expect, type Page } from '@playwright/test';
import { dueMonth, ensure, feedBook, loadWithFeeds, monthName, testDay, testTime } from './feeds-fixture';

// P263: Tata Motors' monthly release read by Claude (owner, 10 Nov 2026: "For Tata Motors I have to enter the figures by hand, let's
// have it so that those are updated by reading the news and related release"). Anthropic's API is faked at the route layer: the
// request is checked (the key, the browser header, the model, the web tools held to Tata's site and the exchanges, the tool the
// answer comes back through), and the answer is the month's figures, saved only when they add up. Every figure is made up.

const ANTHROPIC = 'https://api.anthropic.com/**';
const W = (page: Page) => page.evaluate.bind(page);
const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const M = dueMonth();
const NAME = monthName(M);
const RELEASED = testDay().slice(0, 7) + '-01';
const URL_OK = 'https://www.tatamotors.com/press-releases/cv-sales-example/';
const FIGS = { cvTotal: { now: 41230, ly: 38940 }, cvDomestic: { now: 36105, ly: 34800 }, cvExport: { now: 5125, ly: 4140 }, hcv: { now: 11020, ly: 10330 } };
const read = (o: Record<string, unknown> = {}) => ({ found: true, month: M, source: 'release', released: RELEASED, url: URL_OK, ...FIGS,
  quote: 'Total CV sales 41,230 (38,940); domestic 36,105 (34,800); international 5,125 (4,140); HCV trucks 11,020 (10,330).', note: '', ...o });
const reply = (input: unknown, extra: Record<string, unknown> = {}) => ({ id: 'msg_tata', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content: [
    { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'Tata Motors CV sales' } },
    { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [] },
    { type: 'text', text: 'Recording the figures.' },
    { type: 'tool_use', id: 'tu_1', name: 'record_release', input },
  ],
  stop_reason: 'tool_use', usage: { input_tokens: 20000, output_tokens: 800, server_tool_use: { web_search_requests: 2 } }, ...extra });

/* The app booted on the test day with the feeds faked, the Claude key on the device and the release reading switched on under test.
   Anthropic answers `answer(n)` on its n-th request; the requests are kept. */
async function boot(page: Page, answer: (n: number) => { status?: number; body: unknown }, o: { key?: string; on?: boolean; state?: any } = {}) {
  await loadWithFeeds(page, o.state || feedBook());
  await page.evaluate(({ k, on }) => {
    try { if (k) localStorage.setItem('sep_inv_claude_key', k); localStorage.removeItem('sep_inv_tata_read'); localStorage.removeItem('sep_inv_claude_spent'); } catch (e) { /* none */ }
    if (on) (window as any).__sepTataReadOn = true;
  }, { k: o.key === undefined ? 'sk-ant-test' : o.key, on: o.on !== false });
  const reqs: Array<{ headers: Record<string, string>; body: any }> = [];
  await page.route(ANTHROPIC, async route => {
    const r = route.request();
    reqs.push({ headers: r.headers(), body: JSON.parse(r.postData() || '{}') });
    const a = answer(reqs.length);
    await route.fulfill({ status: a.status || 200, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  return reqs;
}
const tata = (page: Page) => g(page, `S.market.tata[${JSON.stringify(M)}] || null`);
const kept = (page: Page) => W(page)(m => JSON.parse(localStorage.getItem('sep_inv_tata_read') || '{}')[m] || null, M);

test.describe('P263: Tata Motors’ release read by Claude', () => {
  test('Home asks for the month before: Tata’s site and the exchanges only, and figures that add up are saved with their link', async ({ page }) => {
    const reqs = await boot(page, () => ({ body: reply(read()) }));
    await ensure(page);
    expect(reqs).toHaveLength(1);
    const { headers, body } = reqs[0];
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body.model).toBe('claude-opus-5-5');
    const tools = body.tools.map((t: any) => t.type || t.name);
    expect(tools).toEqual(['web_search_20260209', 'web_fetch_20260209', 'record_release']);
    for (const t of body.tools.slice(0, 2)) expect(t.allowed_domains).toEqual(['tatamotors.com', 'bseindia.com', 'nseindia.com']);
    expect(body.tools[2]).toMatchObject({ name: 'record_release', strict: true });
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.messages[0].content).toContain(M);
    expect(body.messages[0].content).toContain('Do not use news articles');
    // Nothing of the book goes with it.
    expect(JSON.stringify(body)).not.toContain('Test place');
    const rec: any = await tata(page);
    expect(rec).toMatchObject({ src: 'release', url: URL_OK, released: RELEASED, by: 'Tata’s release, read by Claude', ...FIGS });
    expect(rec.note).toContain('India and exports add up to all CVs');
    expect(await kept(page)).toMatchObject({ code: 'saved', tries: 1 });
    // The month is saved: the To-do no longer asks for it, and the widget reads it.
    expect(await W(page)(() => (window as any).todoAppAll().some((t: any) => t.rule === 'mktTata'))).toBe(false);
    expect(await W(page)(() => (window as any).mktTataLatest())).toMatchObject({ state: 'ok', month: M });
    // What it cost is the device's: counted apart from the photos.
    expect(await W(page)(() => JSON.parse(localStorage.getItem('sep_inv_claude_spent') || '{}'))).toMatchObject({ n: 0, tata: 1 });
    expect(await W(page)(() => (window as any).phSpentSay())).toMatch(/^1 Tata release read on this device · /);
    // Saved, the month is not asked again.
    await ensure(page);
    expect(reqs).toHaveLength(1);
  });

  test('figures that do not add up are offered with what failed, never saved; Use puts them in the form', async ({ page }) => {
    const bad = read({ cvDomestic: { now: 39784, ly: 34800 } });
    const reqs = await boot(page, () => ({ body: reply(bad) }));
    await ensure(page);
    expect(reqs).toHaveLength(1);
    expect(await tata(page)).toBeNull();
    const k: any = await kept(page);
    expect(k.code).toBe('offered');
    expect(k.why).toContain('do not add up to all CVs');
    // An offer waits for the owner: Home does not ask again for it.
    await ensure(page);
    expect(reqs).toHaveLength(1);
    await page.evaluate(() => (window as any).mktTataOpen());
    const part = page.locator('[data-mkt-tata] [data-tr-part]');
    await expect(part.locator('[data-tr-last="offered"]')).toContainText('do not add up to all CVs');
    await expect(part.locator('[data-tr-offer]')).toContainText('All CVs 41,230 (38,940)');
    await part.locator('[data-tr-offer]').getByRole('button', { name: 'Use' }).click();
    await expect(page.locator('#mktF_cvDomestic_now')).toHaveValue('39784');
    await expect(page.locator('#mktUrl')).toHaveValue(URL_OK);
    expect(await tata(page)).toBeNull();
  });

  test('a link off Tata’s site, a month before the release, or the wrong month is offered, not saved', async ({ page }) => {
    for (const [o, words] of [
      [{ url: 'https://news.example.com/tata-cv-sales' }, 'not Tata Motors’ site or an exchange filing'],
      [{ month: '2020-01' }, 'not ' + NAME],
      [{ released: M + '-15' }, 'before the month ended'],
    ] as Array<[Record<string, unknown>, string]>) {
      const reqs = await boot(page, () => ({ body: reply(read(o)) }));
      await ensure(page);
      expect(reqs).toHaveLength(1);
      expect(await tata(page)).toBeNull();
      expect((await kept(page) as any).why).toContain(words);
    }
  });

  test('a release not out yet is asked again after 6 hours, 8 times a month at most', async ({ page }) => {
    const reqs = await boot(page, () => ({ body: reply({ ...read(), found: false, source: 'none', url: null, released: null }) }));
    await ensure(page);
    expect(await kept(page)).toMatchObject({ code: 'notout', tries: 1 });
    await ensure(page);
    expect(reqs).toHaveLength(1);
    for (let i = 1; i < 10; i++) {
      await page.clock.setFixedTime(new Date(testTime().getTime() + i * 6.1 * 3600000));
      await ensure(page);
    }
    expect(reqs).toHaveLength(8);
    expect(await kept(page)).toMatchObject({ code: 'notout', tries: 8 });
    expect(await tata(page)).toBeNull();
  });

  test('a month typed by hand is never written over: the release that agrees says so, one that differs is offered', async ({ page }) => {
    const typed = { ...FIGS, released: '', url: '', note: '', at: 1, by: 'Owner' };
    const state: any = { ...feedBook(), market: { tata: { [M]: typed }, calendar: {}, weather: {}, models: [] } };
    let answer = read();
    const reqs = await boot(page, () => ({ body: reply(answer) }), { state });
    // Typed, the month is not due: Home asks nothing. The dialog's button asks.
    await ensure(page);
    expect(reqs).toHaveLength(0);
    await page.evaluate(() => (window as any).mktTataOpen());
    const part = page.locator('[data-mkt-tata] [data-tr-part]');
    await part.getByRole('button', { name: 'Read the release' }).click();
    await expect(part.locator('[data-tr-last="agrees"]')).toContainText('agrees with what is typed');
    answer = read({ hcv: { now: 11900, ly: 10330 } });
    await part.getByRole('button', { name: 'Read the release' }).click();
    await expect(part.locator('[data-tr-last="offered"]')).toContainText('differs from what is typed');
    expect(reqs).toHaveLength(2);
    expect(await tata(page)).toMatchObject({ by: 'Owner', hcv: { now: 11020 } });
    // A figure left blank by hand that the release prints is a difference too: offered, the blank kept.
    await g(page, `S.market.tata[${JSON.stringify(M)}].cvExport = { now: 5125, ly: null }`);
    answer = read();
    await part.getByRole('button', { name: 'Read the release' }).click();
    await expect(part.locator('[data-tr-last="offered"]')).toBeVisible();
    expect(reqs).toHaveLength(3);
    expect(await tata(page)).toMatchObject({ cvExport: { now: 5125, ly: null } });
  });

  test('a paused turn is sent back and the server goes on', async ({ page }) => {
    const paused = { id: 'msg_p', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      content: [{ type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'x' } }], stop_reason: 'pause_turn', usage: { input_tokens: 9000, output_tokens: 200 } };
    const reqs = await boot(page, n => ({ body: n === 1 ? paused : reply(read()) }));
    await ensure(page);
    expect(reqs).toHaveLength(2);
    expect(reqs[1].body.messages).toHaveLength(2);
    expect(reqs[1].body.messages[1]).toMatchObject({ role: 'assistant', content: paused.content });
    expect(await tata(page)).toMatchObject({ src: 'release' });
  });

  test('nothing is asked with no key, under test without the switch, offline, or for an ID that may not change Settings', async ({ page }) => {
    let reqs = await boot(page, () => ({ body: reply(read()) }), { key: '' });
    await ensure(page);
    expect(reqs).toHaveLength(0);
    reqs = await boot(page, () => ({ body: reply(read()) }), { on: false });
    await ensure(page);
    expect(reqs).toHaveLength(0);
    reqs = await boot(page, () => ({ body: reply(read()) }));
    await page.evaluate(() => { (window as any).grdCan = () => false; });
    await ensure(page);
    expect(reqs).toHaveLength(0);
    await page.evaluate(() => { delete (window as any).grdCan; });
    await page.context().setOffline(true);
    await W(page)(() => (window as any).trEnsure());
    await page.context().setOffline(false);
    expect(reqs).toHaveLength(0);
  });

  test('a refused key or a used-up credit is said in the dialog, and nothing is saved', async ({ page }) => {
    const reqs = await boot(page, () => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }));
    await ensure(page);
    expect(reqs).toHaveLength(1);
    expect(await kept(page)).toMatchObject({ code: 'key' });
    await page.evaluate(() => (window as any).mktTataOpen());
    await expect(page.locator('[data-mkt-tata] [data-tr-last="key"]')).toContainText('Anthropic refused the key');
    expect(await tata(page)).toBeNull();
  });
});
