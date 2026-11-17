import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { emptyState, noSeedIM, openSettingsAt, waitForBoot, STORAGE_KEY, type SepState } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';

/*
 * P280: the new address (S0, docs/SERVER.md §9 step 0; split/move.js; docs/atlas/core/new-address.md). One server, two origins:
 * with P280's header the test server names 127.0.0.1 as the old address and localhost as the new one (tests/e2e/server.mjs), so
 * each keeps its own storage as two hosts would, and the app's origin checks run as built. GitHub is faked at the route layer.
 * Every name, number and key here is made up (HR-10).
 */

export const MOVE_HEADER = { 'x-sep-move-test': '1' };
const PORT = Number(process.env.PW_PORT) || 4173;
export const OLD = `http://127.0.0.1:${PORT}`;
export const NEW = `http://localhost:${PORT}`;
export const EVIL = 'http://evil.test';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';

export const TOKEN = 'github_pat_P280MADEUPTOKEN';
export const CLAUDE = 'sk-ant-P280-made-up-key';
export const METALS = 'P280METALSKEY';
export const IMG = 'img-0123456789abcdef01234567';

/** The entries the old address holds besides the book: each carried one, and two that must not cross. */
export const CARRIED: Record<string, string> = {
  sep_inv_theme: 'dark',
  sep_inv_palette: 'teal',
  sep_inv_layout: JSON.stringify({ v: 2, preset: 'owner', order: ['dofirst'], hidden: [], wide: [] }),
  sep_inv_folds: JSON.stringify({ 'p280-fold': true }),
  sep_inv_face_page: JSON.stringify({ 'u-p280|2026-01-05|L1': { rows: [{ q: 3 }], total: 3, at: 1 } }),
  sep_inv_print_station: JSON.stringify({ on: false, since: 1 }),
  sep_inv_device_id: 'dev-p280bench',
  sep_inv_device_name: 'Bench PC',
};
const SYNC_CFG = JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceId: 'dev-p280bench', deviceName: 'Bench PC' });
const STAYS = { sep_ck_card: '9000', sep_inv_err_queue: '[]' };

export function moveBook(): SepState {
  return { ...emptyState(), clients: [{ id: 7, name: 'DELTA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }], incomingMaterial: noSeedIM() } as SepState;
}

/** GitHub's Contents API for one file. `fail` makes every PUT answer 500. */
export async function fakeGitHub(ctx: BrowserContext, o: { fail?: boolean } = {}) {
  const puts: string[] = [];
  let file: { sha: string; text: string } | null = null;
  await ctx.route(CONTENTS, async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      if (o.fail) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"made-up failure"}' }); return; }
      const body = JSON.parse(req.postData() || '{}');
      puts.push(body.content);
      file = { sha: 'sha' + puts.length, text: Buffer.from(body.content, 'base64').toString('utf8') };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: file.sha } }) });
      return;
    }
    if (!file) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ sha: file.sha, size: file.text.length, content: Buffer.from(file.text).toString('base64') }) });
  });
  return puts;
}

/** The old address as a device that synced: its book (the legacy key, migrated at boot), its entries, its keys. Once per tab. */
export async function seedOld(ctx: BrowserContext, o: { sync?: boolean } = {}) {
  await ctx.addInitScript((a) => {
    if (location.hostname !== '127.0.0.1' || sessionStorage.getItem('__p280')) return;
    sessionStorage.setItem('__p280', '1');
    localStorage.setItem(a.key, a.book);
    Object.keys(a.ls).forEach(k => localStorage.setItem(k, a.ls[k]));
    if (a.sync) {
      localStorage.setItem('sep_inv_github_sync', a.cfg);
      localStorage.setItem('sep_inv_github_token', a.token);
    }
    localStorage.setItem('sep_inv_claude_key', a.claude);
    localStorage.setItem('sep_inv_metals_key', a.metals);
  }, { key: STORAGE_KEY, book: JSON.stringify(moveBook()), ls: { ...CARRIED, ...STAYS }, cfg: SYNC_CFG, token: TOKEN, claude: CLAUDE, metals: METALS, sync: o.sync !== false });
}

export async function openOld(page: Page) {
  await page.goto(OLD + '/');
  await waitForBoot(page);
  // A photo in the knowledge base's own database.
  await page.evaluate((id) => (window as any).kbMediaPut(id, new Blob(['made-up photo bytes for P280'], { type: 'image/jpeg' })), IMG);
}

/** Settings → Data & device → The new address → Move, then Open the new address; resolves the new address's window. */
export async function startMove(page: Page, stops?: Stop[]): Promise<Page> {
  await openSettingsAt(page, 'move');
  await page.locator('[data-action="invMoveStart"]').click();
  const open = page.locator('[data-move-dialog] [data-action="invMoveOpen"]');
  await expect(open).toBeVisible();
  if (stops) stops.push(await sweep(page, 'the dialog: pushed'));
  const [popup] = await Promise.all([page.context().waitForEvent('page'), open.click()]);
  return popup;
}

export const ls = (p: Page, keys: string[]) => p.evaluate((ks) => Object.fromEntries(ks.map(k => [k, localStorage.getItem(k)])), keys);
export const bookRaw = (p: Page) => p.evaluate(() => new Promise<string | null>((resolve) => {
  const rq = indexedDB.open('sep-invoicing', 1);
  rq.onupgradeneeded = () => { rq.result.createObjectStore('state'); };
  rq.onerror = () => resolve(null);
  rq.onsuccess = () => {
    const db = rq.result;
    const g = db.transaction('state').objectStore('state').get('current');
    g.onsuccess = () => { db.close(); resolve(typeof g.result === 'string' ? g.result : null); };
    g.onerror = () => { db.close(); resolve(null); };
  };
}));
export const photo = (p: Page, id: string) => p.evaluate((i) => new Promise<string | null>((resolve) => {
  const rq = indexedDB.open('sep-invoicing-media', 1);
  rq.onupgradeneeded = () => { rq.result.createObjectStore('images'); };
  rq.onerror = () => resolve(null);
  rq.onsuccess = () => {
    const db = rq.result;
    const g = db.transaction('images').objectStore('images').get(i);
    g.onsuccess = () => { db.close(); const b = g.result; if (b instanceof Blob) b.text().then(resolve); else resolve(null); };
    g.onerror = () => { db.close(); resolve(null); };
  };
}), id);

export function moveSpecs() {
  test.use({ extraHTTPHeaders: MOVE_HEADER });

  test('the new address with no book waits for it, starts nothing and writes nothing', async ({ page }) => {
    await page.goto(NEW + '/');
    await expect(page.locator('[data-move-screen]')).toContainText('Waiting for the book');
    // It names the old address to open (here, the test's old origin).
    await expect(page.locator('[data-move-screen]')).toContainText('127.0.0.1:' + PORT);
    // The app never started: no book in memory, none on disk, nothing written to the device.
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.body.classList.contains('inv-booted'))).toBe(false);
    expect(await page.evaluate(() => (0, eval)('S'))).toBeNull();
    expect(await bookRaw(page)).toBeNull();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /^sep_inv/.test(k)))).toEqual([]);
    // The screen is the design system's (P76's checks: its classes styled, nothing white, nothing off the glass).
    await page.locator('.inv-move-other > summary').click();
    // The shell's page under it is blank, as it must be: the app has not started.
    const stop = await sweep(page, 'waiting');
    expect(stop.blank).toBe(true);
    expect(problems([{ ...stop, blank: false }])).toEqual([]);
    // The other way: start empty, by the owner's choice, and the app starts.
    await page.locator('[data-action="invMoveOwn"]').click();
    await page.locator('[data-action="invMoveOwnYes"]').click();
    await waitForBoot(page);
    await expect(page.locator('[data-move-screen]')).toHaveCount(0);
  });

  test('the handover carries the book, the photos, every listed entry and the keys; the old address then forwards', async ({ page, context }) => {
    await fakeGitHub(context);
    await seedOld(context);
    await openOld(page);
    // Before the move the old address is the app, not a forward.
    expect(new URL(page.url()).origin).toBe(OLD);
    await expect(page.locator('[data-move-screen]')).toHaveCount(0);

    const stops: Stop[] = [];
    await openSettingsAt(page, 'move');
    stops.push(await sweep(page, 'settings: the new address'));
    const popup = await startMove(page, stops);
    await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Moved', { timeout: 20000 });
    await expect(page.locator('[data-move-dialog] [data-move-said]')).toContainText('1 photo');
    stops.push(await sweep(page, 'the dialog: moved'));
    await page.locator('[data-move-dialog] [data-action="invCloseConfirm"]').click();
    await expect(page.locator('[data-move-screen]')).toContainText('Moved to the new address');
    stops.push(await sweep(page, 'the old window, moved'));

    // The new address reloaded itself into the app, with the book.
    await popup.waitForURL(u => u.origin === NEW && !u.search.includes('move=1'));
    await waitForBoot(popup);
    expect(await popup.evaluate(() => (0, eval)('S').clients.map((c: any) => c.name))).toEqual(['DELTA AUTO']);
    expect(await photo(popup, IMG)).toBe('made-up photo bytes for P280');
    expect(await ls(popup, Object.keys(CARRIED))).toEqual(CARRIED);
    expect(JSON.parse((await ls(popup, ['sep_inv_github_sync'])).sep_inv_github_sync!)).toMatchObject({ owner: 'testowner', repo: 'testrepo', deviceId: 'dev-p280bench' });
    // The keys, each through its setter: the token locked under the new address's own device key, never kept as typed.
    expect(await popup.evaluate(() => [(window as any).getGhToken(), (window as any).phKey(), (window as any).getMetalsKey()])).toEqual([TOKEN, CLAUDE, METALS]);
    const tok = await ls(popup, ['sep_inv_github_token', 'sep_inv_github_token_enc']);
    expect(tok.sep_inv_github_token).toBeNull();
    expect(tok.sep_inv_github_token_enc).toBeTruthy();
    // What does not cross: the check-in card (checkin.html stays on the old address) and the old address's queued reports.
    expect(await ls(popup, Object.keys(STAYS))).toEqual({ sep_ck_card: null, sep_inv_err_queue: null });
    // The office QR made here still points at checkin.html on the old address.
    expect(await popup.evaluate(() => (window as any).ckUrl({ office: '9000000001', lat: 22.5, lng: 86.2, radius: 150, key: 'K1' }, false)))
      .toMatch(new RegExp('^' + OLD.replace(/[.]/g, '\\.') + '/checkin\\.html#'));

    // The old address: marked, its keys deleted (the default), its book and the check-in card kept.
    const old = await ls(page, ['sep_inv_moved', 'sep_inv_claude_key', 'sep_inv_metals_key', 'sep_inv_github_token', 'sep_inv_github_token_enc', 'sep_ck_card']);
    expect(JSON.parse(old.sep_inv_moved!)).toMatchObject({ to: NEW });
    expect([old.sep_inv_claude_key, old.sep_inv_metals_key, old.sep_inv_github_token, old.sep_inv_github_token_enc]).toEqual([null, null, null, null]);
    expect(old.sep_ck_card).toBe('9000');
    expect(JSON.parse((await bookRaw(page))!).clients[0].name).toBe('DELTA AUTO');

    // From now on this device's old address forwards to the new one, keeping a shortcut's screen.
    await page.goto(OLD + '/?tab=pageCreate', { waitUntil: 'commit' });
    await page.waitForURL(u => u.origin === NEW && new URL(u).searchParams.get('tab') === 'pageCreate');
    await waitForBoot(page);
    // ?stay=1 opens the copy left behind, which says what it is.
    await page.goto(OLD + '/?stay=1');
    await waitForBoot(page);
    await expect(page.locator('.inv-notice-bar')).toContainText('copy left behind');
    await openSettingsAt(page, 'move');
    await expect(page.locator('[data-action="invMoveDeleteOld"]')).toBeVisible();
    stops.push(await sweep(page, 'settings: the copy left behind'));
    expect(problems(stops)).toEqual([]);
  });

  test('the old address says Moved only once the new one has read every piece back', async ({ page, context }) => {
    await fakeGitHub(context);
    await seedOld(context);
    // The new address's browser drops one entry without a word, as a store that does not keep a write.
    await context.addInitScript(() => {
      if (location.hostname !== 'localhost') return;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) { if (k === 'sep_inv_theme') return; return set.call(this, k, v); };
    });
    await openOld(page);
    const popup = await startMove(page);
    await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Nothing was moved', { timeout: 20000 });
    await expect(page.locator('[data-move-dialog]')).toContainText('sep_inv_theme');
    // The new address undid what it wrote and is still waiting, empty.
    await expect(popup.locator('[data-move-status]')).toContainText('Nothing was kept here');
    expect(await bookRaw(popup)).toBeNull();
    expect(await photo(popup, IMG)).toBeNull();
    expect(await ls(popup, ['sep_inv_layout', 'sep_inv_github_token', 'sep_inv_github_token_enc', 'sep_inv_claude_key', 'sep_inv_metals_key', 'sep_inv_move_in', 'sep_inv_idb_used']))
      .toEqual({ sep_inv_layout: null, sep_inv_github_token: null, sep_inv_github_token_enc: null, sep_inv_claude_key: null, sep_inv_metals_key: null, sep_inv_move_in: null, sep_inv_idb_used: null });
    // The old address is unchanged: no mark, its keys kept, and it does not forward.
    expect(await ls(page, ['sep_inv_moved', 'sep_inv_claude_key', 'sep_inv_metals_key'])).toEqual({ sep_inv_moved: null, sep_inv_claude_key: CLAUDE, sep_inv_metals_key: METALS });
    await page.goto(OLD + '/');
    await waitForBoot(page);
    expect(new URL(page.url()).origin).toBe(OLD);
  });

  test('nothing is moved while the book is not pushed', async ({ page, context }) => {
    // GitHub refuses the push: no window opens, nothing is marked.
    await fakeGitHub(context, { fail: true });
    await seedOld(context);
    await openOld(page);
    await openSettingsAt(page, 'move');
    await page.locator('[data-action="invMoveStart"]').click();
    await expect(page.locator('[data-move-dialog]')).toContainText('the book is not pushed to GitHub');
    await expect(page.locator('[data-move-dialog] [data-action="invMoveOpen"]')).toHaveCount(0);
    expect(context.pages()).toHaveLength(1);
    expect((await ls(page, ['sep_inv_moved'])).sep_inv_moved).toBeNull();
  });

  test('a device with no GitHub sync is told to set it up; nothing is moved', async ({ page, context }) => {
    await seedOld(context, { sync: false });
    await openOld(page);
    await openSettingsAt(page, 'move');
    await page.locator('[data-action="invMoveStart"]').click();
    await expect(page.locator('[data-ui-ask]')).toContainText('GitHub sync is not set up on this device');
    expect(context.pages()).toHaveLength(1);
    expect((await ls(page, ['sep_inv_moved'])).sep_inv_moved).toBeNull();
  });

  test('the new address refuses an offer from any origin but the old address', async ({ page, context }) => {
    await context.route(EVIL + '/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>P280 elsewhere</title>' }));
    await page.goto(EVIL + '/');
    await page.evaluate(() => { (window as any).__got = []; addEventListener('message', e => (window as any).__got.push(e.data)); });
    const [popup] = await Promise.all([context.waitForEvent('page'), page.evaluate((u) => { (window as any).__w = window.open(u + '/?move=1', 'p280'); }, NEW)]);
    await expect(popup.locator('[data-move-screen]')).toContainText('Waiting for the book');
    // An offer posted from elsewhere, whole and well formed as the old address's would be (its digest true): only the origin is wrong.
    const b = JSON.stringify(moveBook());
    const digest = createHash('sha256').update(b, 'utf8').digest('hex');
    await page.evaluate(([b, digest]) => (window as any).__w.postMessage({ type: 'sep-move-offer', v: 1, nonce: 'p280', store: { current: b }, media: [], ls: { sep_inv_theme: 'dark' },
      keys: { github: 'github_pat_ELSEWHERE' }, digest }, '*'), [b, digest]);
    await expect.poll(() => popup.evaluate(() => (window as any)._moveRefusedNew)).toBeGreaterThan(0);
    expect(await bookRaw(popup)).toBeNull();
    expect(await popup.evaluate(() => Object.keys(localStorage).filter(k => /^sep_inv/.test(k)))).toEqual([]);
    expect(await popup.evaluate(() => document.body.classList.contains('inv-booted'))).toBe(false);
    // Its "ready" went to the old address's origin only: this page heard nothing.
    expect(await page.evaluate(() => (window as any).__got)).toEqual([]);
  });

  test('the old address sends nothing on a message from any origin or window but the new address it opened', async ({ page, context }) => {
    await fakeGitHub(context);
    await seedOld(context);
    // The new address stays silent (a blank page there), so only the forged messages could move anything.
    await context.route(NEW + '/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>P280 silent</title>' }));
    await context.route(EVIL + '/**', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><script>var n=new URLSearchParams(location.search).get("n");' +
      'parent.postMessage({type:"sep-move-ready",v:1},"*");parent.postMessage({type:"sep-move-done",v:1,nonce:n,ok:true},"*");</script>' }));
    await openOld(page);
    await startMove(page);
    const nonce = await page.evaluate(() => (window as any)._moveSess.nonce);
    // From another origin, framed in the old address's own page, with the right nonce; and from the old address's own window.
    await page.evaluate(({ evil, n }) => {
      const f = document.createElement('iframe');
      f.src = evil + '/frame?n=' + n;
      document.body.appendChild(f);
      window.postMessage({ type: 'sep-move-ready', v: 1 }, '*');
    }, { evil: EVIL, n: nonce });
    await expect.poll(() => page.evaluate(() => (window as any)._moveSess && (window as any)._moveSess.refused)).toBeGreaterThanOrEqual(3);
    expect(await page.evaluate(() => [(window as any)._moveSess.stage, (window as any)._moveSess.sent])).toEqual(['opened', 0]);
    expect((await ls(page, ['sep_inv_moved', 'sep_inv_claude_key'])).sep_inv_moved).toBeNull();
    expect((await ls(page, ['sep_inv_claude_key'])).sep_inv_claude_key).toBe(CLAUDE);
  });

  test('the copy left behind can be deleted; the old address then only forwards, and the check-in card stays', async ({ page, context }) => {
    await fakeGitHub(context);
    await seedOld(context);
    await openOld(page);
    const popup = await startMove(page);
    await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Moved', { timeout: 20000 });
    await popup.close();
    await page.goto(OLD + '/?stay=1');
    await waitForBoot(page);
    await openSettingsAt(page, 'move');
    await page.locator('[data-action="invMoveDeleteOld"]').click();
    await page.locator('[data-ui-ask] [data-ans="ok"]').click();
    await page.waitForURL(u => u.origin === NEW);
    // Read the old origin's storage from a page of it that is not the app.
    await page.goto(OLD + '/version.json');
    expect(await bookRaw(page)).toBeNull();
    expect(await photo(page, IMG)).toBeNull();
    const left = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(left).toEqual(['sep_ck_card', 'sep_inv_moved']);
  });
}
