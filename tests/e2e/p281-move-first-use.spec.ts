import { test, expect, type Page } from '@playwright/test';
import { openSettingsAt, waitForBoot } from './fixtures';
import { MOVE_HEADER, OLD, NEW, CLAUDE, fakeGitHub, seedOld, openOld, startMove, ls, bookRaw } from './p280-move.fixture';
import { sweep, problems } from './sweep-fixture';

/*
 * P281: the move's first real use (20 Nov 2026; split/move.js; docs/atlas/core/new-address.md, "First use"). P280's two origins
 * (tests/e2e/server.mjs: 127.0.0.1 the old address, localhost the new); with `x-sep-move-ms` the move's waits are shortened, only
 * on that request. What it found: the app installed from the new address before the move swallowed the move's window (no opener);
 * the push before the move waited on a lock with no limit. Every name, number and key here is made up (HR-10).
 */
test.use({ extraHTTPHeaders: MOVE_HEADER });

/** The browser's install offer, as Chrome fires it: true when the page held it back. */
const installHeld = (p: Page) => p.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});

test('the new address holds back the install offer while it waits for the book, and says not to install yet', async ({ page, context }) => {
  await page.goto(NEW + '/');
  await expect(page.locator('[data-move-screen]')).toContainText('Waiting for the book');
  const said = page.locator('[data-move-noinstall]');
  await expect(said).toContainText('Do not install the app from here yet');
  await expect(said).toContainText('Move first, from a browser tab in the browser the app is installed in');
  await expect(said).toContainText('Install from here after the move');
  expect(await installHeld(page)).toBe(true);
  // Held back, not written down: the waiting address still writes nothing.
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /^sep_inv/.test(k)))).toEqual([]);
  await page.locator('.inv-move-other > summary').click();
  const stop = await sweep(page, 'waiting, the install held');
  expect(problems([{ ...stop, blank: false }])).toEqual([]);
  // Once a book is here (the owner started empty), the offer is the browser's again.
  await page.locator('[data-action="invMoveOwn"]').click();
  await page.locator('[data-action="invMoveOwnYes"]').click();
  await waitForBoot(page);
  expect(await installHeld(page)).toBe(false);
  // The old address never holds it back.
  await seedOld(context);
  const old = await context.newPage();
  await old.goto(OLD + '/');
  await waitForBoot(old);
  expect(await installHeld(old)).toBe(false);
});

test("the move's window landing without its opener says why and what to do; nothing is written", async ({ page }) => {
  // The move's own marker, but no window opened this one: as when the phone routes window.open into an app installed here.
  await page.goto(NEW + '/?move=1');
  const status = page.locator('[data-move-status]');
  await expect(status).toContainText('This window opened without its link back to the old address');
  await expect(status).toContainText('the app is installed from this address');
  await expect(status).toContainText('Uninstall the app installed from this address (it holds no book), close this window, and press Move again');
  await expect(status).toHaveClass(/inv-callout-danger/);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.body.classList.contains('inv-booted'))).toBe(false);
  expect(await bookRaw(page)).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /^sep_inv/.test(k)))).toEqual([]);
  // Without the marker the screen says nothing of the kind.
  await page.goto(NEW + '/');
  await expect(page.locator('[data-move-screen]')).toContainText('Waiting for the book');
  await expect(page.locator('[data-move-status]')).toHaveText('');
});

test('a push held by another window times out; nothing is moved, and the push that lands late moves nothing', async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ ...MOVE_HEADER, 'x-sep-move-ms': 'MOVE_PUSH_MS=1500' });
  await fakeGitHub(context);
  await seedOld(context);
  await openOld(page);
  expect(await page.evaluate(() => (0, eval)('MOVE_PUSH_MS'))).toBe(1500);
  // The push's lock held, as another window of the old address holds it while it pushes or hangs.
  await page.evaluate(() => { navigator.locks.request('sep-invoicing-gh-push', () => new Promise<void>((r) => { (window as any).__release = r; })); });
  await expect.poll(() => page.evaluate(() => typeof (window as any).__release)).toBe('function');
  await openSettingsAt(page, 'move');
  await page.locator('[data-action="invMoveStart"]').click();
  await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Pushing to GitHub');
  await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Nothing was moved', { timeout: 10000 });
  await expect(page.locator('[data-move-dialog]')).toContainText('Another window of the old address may be pushing or busy: close the other windows of the old address, then move again');
  // The lock let go: the waiting push runs and lands, and moves nothing.
  await page.evaluate(() => (window as any).__release());
  await expect.poll(() => page.evaluate(() => navigator.locks.query().then(q => (q.held || []).length + (q.pending || []).length))).toBe(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => [(window as any)._moveSess, (window as any)._moveLast && (window as any)._moveLast.stage])).toEqual([null, 'failed']);
  await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Nothing was moved');
  await expect(page.locator('[data-action="invMoveOpen"]')).toHaveCount(0);
  expect(context.pages()).toHaveLength(1);
  expect(await ls(page, ['sep_inv_moved', 'sep_inv_claude_key'])).toEqual({ sep_inv_moved: null, sep_inv_claude_key: CLAUDE });
  // With the lock free, Move again goes through to the push and on.
  await page.locator('[data-move-dialog] .inv-dialog-foot [data-action="invCloseConfirm"]').click();
  await page.locator('[data-action="invMoveStart"]').click();
  await expect(page.locator('[data-move-dialog] [data-action="invMoveOpen"]')).toBeVisible();
});

test('the new address not answering names the app installed from it as the likely cause', async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ ...MOVE_HEADER, 'x-sep-move-ms': 'MOVE_WAIT_READY_MS=1500' });
  await fakeGitHub(context);
  await seedOld(context);
  // The window the move opens never answers, as one the phone gave to an installed app.
  await context.route(NEW + '/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>P281 silent</title>' }));
  await openOld(page);
  await startMove(page);
  await expect(page.locator('[data-move-dialog] .inv-dialog-title')).toHaveText('Nothing was moved', { timeout: 10000 });
  await expect(page.locator('[data-move-dialog]')).toContainText('If the app is installed from the new address on this device, uninstall it (it holds no book)');
  expect((await ls(page, ['sep_inv_moved'])).sep_inv_moved).toBeNull();
});
