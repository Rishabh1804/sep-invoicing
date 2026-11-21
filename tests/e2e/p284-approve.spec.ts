import { test, expect, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { loadAppWithState, readStoredState, openSettingsAt, answerAsk, waitForBoot } from './fixtures';
import { PINS, g, guardBook, lockNow, pickId, unlock, windowGone, withUsers } from './p140-guard.fixture';
import { MOVE_HEADER, bookRaw } from './p280-move.fixture';

// P284: a sign-in approved from a device of the owner's (split/approve.js; docs/atlas/platform/guard.md). Device A holds the book
// and the owner's passkey (Chromium's virtual authenticator); device B is a second browser context with no authenticator. B shows a
// request (a QR and its link), A opens the link and approves with the passkey, the answer crosses the relay (/api/relay/<id>: the
// test server's in-memory copy of the Worker's, tests/e2e/server.mjs) sealed to B's key, and B checks it before anything signs in.
// A book-less B (the new address's waiting screen: P280's header makes this server's localhost the new address) loads the book from
// GitHub (faked at the route layer) with the token the approval hands over, and is then a borrowed device. Every name, number and
// key is made up (HR-10).

const PORT = Number(process.env.PW_PORT) || 4173;
const NEW = `http://localhost:${PORT}`;
test.use({ baseURL: NEW });
const PHONE = devices['Pixel 5'];
const TOKEN = 'github_pat_P284MADEUPTOKEN0000000000';
const CONTENTS = 'https://api.github.com/repos/testowner/testrepo/contents/**';
const SYNC = { owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceId: 'dev-p284a', deviceName: 'Office phone' };

async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
}
/* Device A: the guard's book, the owner signed in by the PIN, a passkey added on it; with `sync`, GitHub sync set up with a token. */
async function deviceA(page: Page, o: { sync?: boolean } = {}) {
  await authenticator(page);
  if (o.sync) {
    await page.context().addInitScript((a) => {
      if (sessionStorage.getItem('__p284a')) return;
      sessionStorage.setItem('__p284a', '1');
      localStorage.setItem('sep_inv_github_sync', a.cfg);
      localStorage.setItem('sep_inv_github_token', a.token);
    }, { cfg: JSON.stringify(SYNC), token: TOKEN });
  }
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  await openSettingsAt(page, 'users');
  await page.locator('[data-grd-pks="U-own"] [data-action="invGuardPkAdd"]').click();
  await expect.poll(async () => ((await readStoredState(page)).users.find((u: any) => u.id === 'U-own').passkeys || []).length).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsScrim')).toHaveCount(0);
  return readStoredState(page);
}
/* Device B: another browser, no authenticator. */
async function deviceB(browser: Browser, header = false): Promise<{ ctx: BrowserContext; b: Page }> {
  const ctx = await browser.newContext({ ...PHONE, baseURL: NEW, serviceWorkers: 'block', extraHTTPHeaders: header ? MOVE_HEADER : undefined });
  return { ctx, b: await ctx.newPage() };
}
/* B's request, as it shows it: the link (the QR's text) and the check code. */
async function requestOn(b: Page) {
  const link = b.locator('[data-grd-ap-link]');
  await expect(link).toBeVisible();
  await expect(b.locator('[data-grd-ap-qr] svg.inv-qr path')).toHaveCount(1);
  return { url: await link.inputValue(), code: (await b.locator('[data-grd-ap-code]').textContent())!.trim() };
}
/* A opens the link (a fresh load), checks the code and approves; `book`: the tick-box as A should show it. */
async function approveOn(a: Page, req: { url: string; code: string }, o: { book?: boolean; before?: () => Promise<void> } = {}) {
  await a.goto('about:blank');
  await a.goto(req.url);
  await waitForBoot(a);
  const give = a.locator('[data-grd-ap-give]');
  await expect(give).toBeVisible();
  await expect(give.locator('[data-grd-ap-code]')).toHaveText(req.code);
  await expect(give.locator('[data-grd-ap-ask]')).toContainText('Sign in as Asha Rao on');
  if (o.book === undefined) await expect(give.locator('#grdApBook')).toHaveCount(0);
  else await expect(give.locator('#grdApBook')).toBeChecked({ checked: o.book });
  // The request was taken off the address.
  expect(new URL(a.url()).hash).toBe('');
  if (o.before) await o.before();
  await give.locator('[data-action="invGuardApOk"]').click();
  await expect(give.locator('[data-grd-ap-sent]')).toBeVisible();
  return give;
}
const signedIn = (p: Page) => p.evaluate(() => (window as any).grdUserId());
/* GitHub's Contents API for the one sync file, holding `state` as a sync envelope. `fail` refuses every PUT. */
async function fakeGitHub(ctx: BrowserContext, state: any) {
  const gh = { text: JSON.stringify({ app: 'sep-invoicing', schema: 1, savedAt: Date.now(), device: 'Office phone', deviceId: 'dev-p284a',
    counts: { invoices: state.invoices.length, challans: 0, clients: state.clients.length, items: 0 }, state }), sha: 'sha-1', n: 1, puts: [] as string[], fail: false };
  await ctx.route(CONTENTS, async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      if (gh.fail) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"made-up failure"}' }); return; }
      const body = JSON.parse(req.postData() || '{}');
      if (body.sha && body.sha !== gh.sha) { await route.fulfill({ status: 409, contentType: 'application/json', body: '{"message":"sha"}' }); return; }
      gh.text = Buffer.from(body.content, 'base64').toString('utf8');
      gh.sha = 'sha-' + (++gh.n);
      gh.puts.push(body.message);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: gh.sha } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: gh.sha, size: gh.text.length, content: Buffer.from(gh.text).toString('base64') }) });
  });
  return gh;
}
/* Every place the token must never be: the book in memory and on disk, the change log, the page. */
async function tokenNowhere(p: Page) {
  const r = await p.evaluate(async (t) => {
    const S = (0, eval)('S');
    const disk = await (window as any).readPersistedStateRaw().catch(() => '');
    return { s: JSON.stringify(S || {}).includes(t), log: JSON.stringify((S && S.changeLog) || []).includes(t), dom: document.documentElement.outerHTML.includes(t),
      disk: String(disk || '').includes(t), ls: Object.keys(localStorage).some(k => String(localStorage.getItem(k)).includes(t)) };
  }, TOKEN);
  expect(r).toEqual({ s: false, log: false, dom: false, disk: false, ls: false });
}
const lsOf = (p: Page) => p.evaluate(() => Object.keys(localStorage).filter(k => /^sep_inv/.test(k)).sort());

/* A book-less B through the approval: the waiting screen, A approves with the book ticked, B loads, signs in, is borrowed and
   registers (its first push). */
async function borrow(browser: Browser, page: Page) {
  const book = await deviceA(page, { sync: true });
  const { ctx, b } = await deviceB(browser, true);
  const gh = await fakeGitHub(ctx, book);
  await b.goto(NEW + '/');
  await expect(b.locator('[data-move-screen]')).toContainText('Waiting for the book');
  await b.locator('[data-action="invGuardApWait"]').click();
  const req = await requestOn(b);
  await approveOn(page, req, { book: true });
  await waitForBoot(b);
  expect(await signedIn(b)).toBe('U-own');
  await expect.poll(() => gh.puts.length).toBe(1);
  expect(gh.puts[0]).toContain('(borrowed) registered for Asha Rao');
  return { book, ctx, b, gh };
}

test.describe('P284: a sign-in approved from a device of the owner\'s', () => {
  test('B signs in as the owner when A approves; the re-ask is answered the same way; the answer is sealed on the relay', async ({ page, browser }) => {
    const book = await deviceA(page);
    const { ctx, b } = await deviceB(browser);
    // The relay's body as it crossed: never the assertion in the clear.
    const crossed: string[] = [];
    await ctx.route('**/api/relay/*', async (route) => {
      const res = await route.fetch();
      if (res.status() === 200) crossed.push(await res.text());
      await route.fulfill({ response: res });
    });
    await loadAppWithState(b, book);
    const lock = b.locator('#guardRoot');
    await pickId(b, 'U-own');
    // No passkey here (no authenticator): the PIN, and the approval under it.
    await expect(lock.locator('#grdPin')).toBeVisible();
    await lock.locator('[data-action="invGuardApStart"]').click();
    await expect(lock.locator('[data-grd-ap-state="wait"]')).toBeVisible();
    const req = await requestOn(b);
    expect(req.url).toMatch(new RegExp('^' + NEW + '/#approve=[A-Za-z0-9_-]+$'));
    expect(req.code).toMatch(/^\d{3} \d{3}$/);
    const p = JSON.parse(Buffer.from(req.url.split('#approve=')[1], 'base64url').toString('utf8'));
    expect(Object.keys(p).sort()).toEqual(['b', 'c', 'id', 'k', 'n', 'v']);
    expect([p.v, p.b, Buffer.from(p.k, 'base64url').length, Buffer.from(p.c, 'base64url').length, Buffer.from(p.id, 'base64url').length]).toEqual([1, false, 65, 32, 16]);
    expect(p.n).toBe('Android phone');
    const give = await approveOn(page, req);
    await expect(give.locator('[data-grd-ap-sent]')).toContainText('Approved. Android phone signs in now.');
    await expect(lock).toHaveCount(0);
    expect(await signedIn(b)).toBe('U-own');
    expect(crossed).toHaveLength(1);
    expect(Object.keys(JSON.parse(crossed[0])).sort()).toEqual(['ct', 'iv', 'k', 'v']);
    expect(crossed[0]).not.toContain('webauthn.get');
    // Not borrowed: B had its own book.
    expect(await b.evaluate(() => localStorage.getItem('sep_inv_borrowed'))).toBeNull();

    // The re-ask on B: the approval again, bound to its own request, and the change goes through.
    await windowGone(b);
    await g(b, "cancelInvoice('INV-1')");
    const ask = b.locator('[data-grd-ask]');
    await expect(ask.locator('#grdAskPin')).toBeVisible();
    await ask.locator('[data-action="invGuardApStart"]').click();
    const req2 = await requestOn(b);
    expect(req2.url).not.toBe(req.url);
    await approveOn(page, req2);
    await expect(ask).toHaveCount(0);
    await b.locator('[data-action="invConfirmCancel"]').click();
    await expect.poll(async () => (await readStoredState(b)).invoices.find((i: any) => i.id === 'INV-1').status).toBe('cancelled');
    await ctx.close();
  });

  test('a tampered answer, a wrong challenge, another user\'s answer and a request run out: nothing signs in', async ({ page, browser }) => {
    const book = await deviceA(page);
    const { ctx, b } = await deviceB(browser);
    await loadAppWithState(b, book);
    const lock = b.locator('#guardRoot');
    await pickId(b, 'U-own');
    const start = async () => {
      if (await lock.locator('[data-action="invGuardApAgain"]').count()) await lock.locator('[data-action="invGuardApAgain"]').click();
      else await lock.locator('[data-action="invGuardApStart"]').click();
      return requestOn(b);
    };
    const failed = async (text: string) => {
      await expect(lock.locator('[data-grd-ap-state="fail"]')).toContainText(text);
      expect(await signedIn(b)).toBeNull();
      await expect(lock).toBeVisible();
    };
    // 1. The ciphertext changed on the way (A's PUT, one character of `ct`).
    await page.context().route('**/api/relay/*', async (route) => {
      const r = route.request();
      if (r.method() !== 'PUT') { await route.fallback(); return; }
      const o = JSON.parse(r.postData()!);
      o.ct = o.ct.slice(0, 5) + (o.ct[5] === 'A' ? 'B' : 'A') + o.ct.slice(6);
      await route.fallback({ postData: JSON.stringify(o) });
    });
    await approveOn(page, await start());
    await failed('The answer did not open');
    await page.context().unrouteAll({ behavior: 'wait' });
    // 2. A signs a challenge not bound to this request.
    await approveOn(page, await start(), { before: () => page.evaluate(() => { (window as any).grdApChallenge = () => Promise.resolve(new Uint8Array(32).fill(7)); }) });
    await failed('The approval did not check');
    expect((await b.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_guard_fail') || 'null'))).ids['u:U-own'].n).toBe(1);
    // 3. An answer naming another user (the supervisor).
    await approveOn(page, await start(), { before: () => page.evaluate(() => {
      const w = window as any, seal = w.grdApSeal;
      w.grdApSeal = (p: any, ans: any) => seal(p, { ...ans, uid: 'U-sup' });
    }) });
    await failed('The approval was for another ID');
    // 4. The relay says the answer ran out unread (410), and a request left past its two minutes: each says so.
    await ctx.route('**/api/relay/*', (route) => route.fulfill({ status: 410, headers: { 'Cache-Control': 'no-store' } }));
    await start();
    await expect(lock.locator('[data-grd-ap-state="over"]')).toContainText('The request ran out');
    await ctx.unrouteAll({ behavior: 'wait' });
    await b.evaluate(() => { (window as any).GRD_AP_WAIT_MS = 2500; });
    await start();
    await expect(lock.locator('[data-grd-ap-state="over"]')).toContainText('The request ran out', { timeout: 10000 });
    expect(await signedIn(b)).toBeNull();
    // Cancel goes back to the PIN.
    await lock.locator('[data-action="invGuardApCancel"]').click();
    await expect(lock.locator('#grdPin')).toBeVisible();
    await ctx.close();
  });

  test.describe('a device with no book', () => {
    test.use({ extraHTTPHeaders: MOVE_HEADER });

    test('loads the book through the approval and is borrowed; the token is never on S, in the change log or on the page', async ({ page, browser }) => {
      const { b, ctx, book } = await borrow(browser, page);
      expect(await b.evaluate(() => (0, eval)('S').clients.length)).toBe(book.clients.length);
      expect(await b.evaluate(() => (0, eval)('S').invoices.map((i: any) => i.id))).toEqual(['INV-1', 'INV-2']);
      const bw = await b.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_borrowed')!));
      expect(Object.keys(bw).sort()).toEqual(['at', 'lastUsed', 'uid']);
      expect(bw.uid).toBe('U-own');
      // The token where GitHub sync keeps it, locked to this device; and the settings handed over.
      expect(await b.evaluate(() => (window as any).getGhToken())).toBe(TOKEN);
      expect(await b.evaluate(() => [localStorage.getItem('sep_inv_github_token'), !!localStorage.getItem('sep_inv_github_token_enc')])).toEqual([null, true]);
      expect(JSON.parse((await b.evaluate(() => localStorage.getItem('sep_inv_github_sync')))!)).toMatchObject({ owner: 'testowner', repo: 'testrepo', branch: 'main' });
      // Registered from the approval: its row on the book's list.
      const dev = await b.evaluate(() => (window as any).devId());
      expect((await readStoredState(b)).devices.find((d: any) => d.id === dev)).toMatchObject({ user: 'U-own' });
      await tokenNowhere(b);
      await tokenNowhere(page);
      // Settings → Data & device says so, with Sign out and clear; the account menu too.
      await openSettingsAt(b, 'data');
      await expect(b.locator('[data-grd-bw-sec]')).toContainText('This device is borrowed');
      await expect(b.locator('details[data-sec="data"] [data-action="invGuardBwClear"]')).toHaveText('Sign out and clear this device');
      await b.keyboard.press('Escape');
      await b.locator('#guardUserBtn').click();
      await expect(b.locator('[data-grd-menu] [data-action="invGuardBwClear"]')).toBeVisible();
      // A's own menu has none: A is not borrowed. Its approval's Done shuts that dialog.
      await page.locator('[data-grd-ap-give] .inv-dialog-foot [data-action="invGuardApNo"]').click();
      await expect(page.locator('[data-grd-ap-give]')).toHaveCount(0);
      await page.locator('#guardUserBtn').click();
      await expect(page.locator('[data-grd-menu] [data-action="invGuardBwClear"]')).toHaveCount(0);
      await ctx.close();
    });

    test('an approval that does not check stores nothing: the token is removed again and the device still waits', async ({ page, browser }) => {
      const book = await deviceA(page, { sync: true });
      const { ctx, b } = await deviceB(browser, true);
      await fakeGitHub(ctx, book);
      await b.goto(NEW + '/');
      await b.locator('[data-action="invGuardApWait"]').click();
      await approveOn(page, await requestOn(b), { book: true, before: () => page.evaluate(() => { (window as any).grdApChallenge = () => Promise.resolve(new Uint8Array(32).fill(9)); }) });
      await expect(b.locator('[data-grd-ap-state="fail"]')).toContainText('The approval did not check against the book');
      expect(await b.evaluate(() => [(window as any).getGhToken(), localStorage.getItem('sep_inv_github_token'), localStorage.getItem('sep_inv_github_token_enc'),
        localStorage.getItem('sep_inv_github_sync'), localStorage.getItem('sep_inv_borrowed'), document.body.classList.contains('inv-booted')])).toEqual(['', null, null, null, null, false]);
      expect(await bookRaw(b)).toBeNull();
      // Without the box ticked there is no token to load the book with: said, and nothing stored.
      await b.locator('[data-action="invGuardApAgain"]').click();
      await approveOn(page, await requestOn(b), { book: true, before: () => page.locator('#grdApBook').uncheck() });
      await expect(b.locator('[data-grd-ap-state="fail"]')).toContainText('came without the sync token');
      expect(await bookRaw(b)).toBeNull();
      expect(await b.evaluate(() => (window as any).getGhToken())).toBe('');
      await ctx.close();
    });

    test('Sign out and clear pushes first: a push that fails clears nothing; one that lands clears it to the waiting screen', async ({ page, browser }) => {
      const { b, ctx, gh } = await borrow(browser, page);
      await b.evaluate(() => { localStorage.setItem('sep_inv_theme', 'dark'); });
      gh.fail = true;
      await b.locator('#guardUserBtn').click();
      await b.locator('[data-grd-menu] [data-action="invGuardBwClear"]').click();
      expect(await answerAsk(b, 'ok')).toContain('If the push does not go through, nothing is cleared.');
      expect(await answerAsk(b, 'ok')).toContain('Nothing was cleared');
      expect(await signedIn(b)).toBe('U-own');
      expect(await bookRaw(b)).not.toBeNull();
      expect(await b.evaluate(() => (window as any).getGhToken())).toBe(TOKEN);
      expect(gh.puts).toHaveLength(1);
      // It reaches GitHub: then the book, the keys and every entry but how it looks are gone, and the device waits again.
      gh.fail = false;
      await openSettingsAt(b, 'data');
      await b.locator('details[data-sec="data"] [data-action="invGuardBwClear"]').click();
      await answerAsk(b, 'ok');
      await expect(b.locator('[data-move-screen]')).toContainText('Waiting for the book', { timeout: 15000 });
      expect(gh.puts).toHaveLength(2);
      expect(await bookRaw(b)).toBeNull();
      expect(await lsOf(b)).toEqual(['sep_inv_theme']);
      expect(await b.evaluate(() => Object.keys(sessionStorage).filter(k => /^sep_inv/.test(k)))).toEqual([]);
      expect(await b.evaluate(() => (window as any).getGhToken())).toBe('');
      await ctx.close();
    });

    test('12 hours unused: held locked for an approval, cleared once a push lands, never before; a lock never clears', async ({ page, browser }) => {
      const { b, ctx, gh } = await borrow(browser, page);
      // A lock is not a clear: Lock now, and a fresh open within the 12 hours, keep everything.
      await lockNow(b);
      await b.waitForTimeout(500);
      expect(await bookRaw(b)).not.toBeNull();
      expect(await b.evaluate(() => [(window as any).getGhToken(), !!localStorage.getItem('sep_inv_borrowed')])).toEqual([TOKEN, true]);
      await b.reload();
      await waitForBoot(b);
      await expect(b.locator('#guardRoot #grdPin')).toBeVisible();
      await expect(b.locator('[data-grd-bw-held]')).toHaveCount(0);
      expect(gh.puts).toHaveLength(1);
      // 13 hours since it was last used, and GitHub out of reach: held, its PIN not offered, nothing cleared.
      gh.fail = true;
      await b.evaluate(() => { const m = JSON.parse(localStorage.getItem('sep_inv_borrowed')!); m.lastUsed = Date.now() - 13 * 3600000; localStorage.setItem('sep_inv_borrowed', JSON.stringify(m)); });
      await b.reload();
      await waitForBoot(b);
      const lock = b.locator('#guardRoot');
      await expect(lock.locator('[data-grd-bw-held]')).toContainText('has not been used for 12 hours');
      await expect(lock.locator('[data-grd-bw-state]')).toContainText('Not cleared yet');
      await expect(lock.locator('#grdPin')).toHaveCount(0);
      await expect(lock.locator('[data-action="invGuardApStart"]')).toBeVisible();
      await expect(lock.locator('[data-action="invGuardPick"], [data-action="invGuardNotYou"]')).toHaveCount(0);
      expect(await bookRaw(b)).not.toBeNull();
      expect(await b.evaluate(() => (window as any).getGhToken())).toBe(TOKEN);
      // Back in reach: the push lands, then it clears.
      gh.fail = false;
      await b.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(b.locator('[data-move-screen]')).toContainText('Waiting for the book', { timeout: 15000 });
      expect(gh.puts.length).toBeGreaterThanOrEqual(2);
      expect(await bookRaw(b)).toBeNull();
      expect(await lsOf(b)).toEqual([]);
      await ctx.close();
    });

    test('held after 12 hours, the approval opens it again', async ({ page, browser }) => {
      const { b, ctx, gh } = await borrow(browser, page);
      gh.fail = true;
      await b.evaluate(() => { const m = JSON.parse(localStorage.getItem('sep_inv_borrowed')!); m.lastUsed = Date.now() - 13 * 3600000; localStorage.setItem('sep_inv_borrowed', JSON.stringify(m)); });
      await b.reload();
      await waitForBoot(b);
      const lock = b.locator('#guardRoot');
      await lock.locator('[data-action="invGuardApStart"]').click();
      await approveOn(page, await requestOn(b));
      await expect(lock).toHaveCount(0);
      expect(await signedIn(b)).toBe('U-own');
      const m = await b.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_borrowed')!));
      expect(Date.now() - m.lastUsed).toBeLessThan(60000);
      await ctx.close();
    });
  });

  test('not offered on the shared github.io address: no request on the lock, and a link opened there is refused', async ({ page, browser }) => {
    const book = await deviceA(page);
    const ctx = await browser.newContext({ ...PHONE, serviceWorkers: 'block' });
    const html = await page.evaluate(() => fetch('/index.html').then(r => r.text()));
    await ctx.route('https://rishabh1804.github.io/**', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.addInitScript((s) => { if (!localStorage.getItem('sep_inv_idb_used')) localStorage.setItem('sep_invoicing_state', s); }, JSON.stringify(book));
    const gp = await ctx.newPage();
    await gp.goto('https://rishabh1804.github.io/sep-invoicing/');
    await waitForBoot(gp);
    expect(await gp.evaluate(() => [location.hostname, (window as any).grdApHere(), (window as any).grdApOffer((0, eval)('S').users.find((u: any) => u.id === 'U-own'))]))
      .toEqual(['rishabh1804.github.io', false, false]);
    await pickId(gp, 'U-own');
    await expect(gp.locator('#guardRoot #grdPin')).toBeVisible();
    await expect(gp.locator('[data-action="invGuardApStart"]')).toHaveCount(0);
    await unlock(gp, 'U-own', PINS.owner);
    const enc = Buffer.from(JSON.stringify({ v: 1, id: 'QUJDREVGR0hJSktMTU5PUA', k: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'),
      c: Buffer.alloc(32, 2).toString('base64url'), n: 'A laptop', b: true })).toString('base64url');
    await gp.goto('https://rishabh1804.github.io/sep-invoicing/#approve=' + enc);
    expect(await answerAsk(gp, 'ok')).toContain('Cannot approve here');
    await expect(gp.locator('[data-grd-ap-give]')).toHaveCount(0);
    await ctx.close();
  });

  test('a device or a user that cannot approve says why, and sends nothing', async ({ page }) => {
    await deviceA(page);
    const p = { v: 1, id: 'QUJDREVGR0hJSktMTU5PUA', k: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), c: Buffer.alloc(32, 2).toString('base64url'), n: 'A laptop', b: false };
    const link = (o: any) => NEW + '/#approve=' + Buffer.from(JSON.stringify(o)).toString('base64url');
    const puts: string[] = [];
    await page.context().route('**/api/relay/*', (route) => { if (route.request().method() === 'PUT') puts.push(route.request().url()); return route.fallback(); });
    const open = async (url: string) => { await page.goto('about:blank'); await page.goto(url); await waitForBoot(page); return answerAsk(page, 'ok'); };
    // A link cut short, and one whose key is not a key.
    expect(await open(NEW + '/#approve=eyJ2IjoxLCJpZCI6')).toContain('Not a sign-in request');
    expect(await open(link({ ...p, k: Buffer.alloc(65, 1).toString('base64url') }))).toContain('Not a sign-in request');
    // The supervisor signed in here: only the owner approves.
    await lockNow(page);
    await unlock(page, 'U-sup', PINS.super);
    expect(await open(link(p))).toContain('Only the owner approves');
    // The owner on a device that offers no passkey of his.
    await lockNow(page);
    await pickId(page, 'U-own');
    await page.locator('#guardRoot [data-action="invGuardPkUse"]').click();
    await expect(page.locator('#guardRoot')).toHaveCount(0);
    await page.evaluate(() => { (window as any).grdPkSupported = () => Promise.resolve(false); });
    // Opened in the window already running (an installed app takes the link): the address's hash, read on its change.
    await page.evaluate((h) => { location.hash = h; }, link(p).split('#')[1]);
    expect(await answerAsk(page, 'ok')).toContain('No passkey here');
    expect(new URL(page.url()).hash).toBe('');
    await expect(page.locator('[data-grd-ap-give]')).toHaveCount(0);
    expect(puts).toEqual([]);
  });

  test('the service worker leaves the relay alone: each poll reaches it, and the answer is never kept in a cache', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, baseURL: NEW, serviceWorkers: 'allow' });
    const p = await ctx.newPage();
    await p.goto('/');
    await waitForBoot(p);
    await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p.reload();
    await waitForBoot(p);
    await expect.poll(() => p.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const r = await p.evaluate(async () => {
      const id = 'P284swRelayTest' + Math.random().toString(36).slice(2, 12).replace(/[^a-z0-9]/g, 'x');
      const url = '/api/relay/' + id;
      const first = (await fetch(url, { cache: 'no-store' })).status;
      const put = (await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'sealed' })).status;
      const got = await fetch(url, { cache: 'no-store' });
      const then = (await fetch(url, { cache: 'no-store' })).status;
      const kept = [];
      for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) if (req.url.includes('/api/')) kept.push(req.url);
      return { first, put, got: got.status, body: await got.text(), then, kept };
    });
    expect(r).toEqual({ first: 204, put: 204, got: 200, body: 'sealed', then: 204, kept: [] });
    await ctx.close();
  });
});
