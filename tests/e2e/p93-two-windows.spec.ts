import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, waitForBoot, type SepState } from './fixtures';

// P93: two windows on one book (UX overhaul 2, step 2). Each window saves the book whole, so a second window used to
// overwrite the first one's save without a word. The saved copy carries a revision: a save from a window holding an
// older copy is refused and the window loads the current one and says so; after every save the other windows load
// it at once; what is being typed in a dialog is kept; two windows never push to GitHub against each other.

function state(): SepState {
  const s = emptyState();
  s.clients = [{ id: 1, name: 'EXISTING CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  return s;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
async function twoWindows(page: Page): Promise<Page> {
  await loadAppWithState(page, state());
  const b = await page.context().newPage();
  await b.goto('/');
  await waitForBoot(b);
  return b;
}
async function openClients(p: Page) {
  await switchTab(p, 'pageClients');
  await p.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();
}
async function addClient(p: Page, name: string) {
  await p.locator('.inv-toolbar [data-action="invAddClient"]').click();
  await p.locator('#ceditName').fill(name);
  await p.locator('[data-action="invSaveClient"][data-mode="add"]').click();
  await expect(p.locator('.inv-scrim-dialog')).toHaveCount(0);
}
const storedNames = async (p: Page) => ((await readStoredState(p)).clients as { name: string }[]).map(c => c.name).sort();

test.describe('P93: two windows on one book', () => {
  test('a save in one window is loaded and drawn in the other at once', async ({ page }) => {
    const b = await twoWindows(page);
    await openClients(page);
    await openClients(b);
    await addClient(page, 'ALPHA PLATING');
    await expect(b.locator('#pageClients')).toContainText('ALPHA PLATING');
    expect(await g(b, 'S.clients.length')).toBe(2);
    // B's next save carries A's client with it.
    await addClient(b, 'BETA PRESS');
    expect(await storedNames(page)).toEqual(['ALPHA PLATING', 'BETA PRESS', 'EXISTING CLIENT']);
    await expect(page.locator('#pageClients')).toContainText('BETA PRESS');
  });

  test('a window that missed the news cannot save over the other: refused, reloaded, said', async ({ page }) => {
    const b = await twoWindows(page);
    await openClients(page);
    await openClients(b);
    // B hears nothing (a frozen tab, a browser without BroadcastChannel).
    await g(b, '_bookChan && _bookChan.close(), _bookChan = false');
    await addClient(page, 'ALPHA PLATING');
    expect(await g(b, 'S.clients.length')).toBe(1);

    await addClient(b, 'BETA PRESS');
    await expect(b.locator('.inv-notice-bar')).toContainText('the last change made here was not saved');
    // A's save stands; B now holds it.
    expect(await storedNames(page)).toEqual(['ALPHA PLATING', 'EXISTING CLIENT']);
    await expect.poll(() => g(b, 'S.clients.map(function(c){ return c.name; }).sort().join()')).toBe('ALPHA PLATING,EXISTING CLIENT');
    await expect(b.locator('#pageClients')).toContainText('ALPHA PLATING');
    // Made again, it saves on top of A's (the notice read and dismissed first: on the phone it sits over the toolbar).
    await b.locator('.inv-notice-bar [data-action="invNoticeDismiss"]').click();
    await addClient(b, 'BETA PRESS');
    expect(await storedNames(page)).toEqual(['ALPHA PLATING', 'BETA PRESS', 'EXISTING CLIENT']);
  });

  test('a window coming back into view checks for a save it did not hear', async ({ page }) => {
    const b = await twoWindows(page);
    await g(b, '_bookChan && _bookChan.close(), _bookChan = false');
    await openClients(page);
    await addClient(page, 'ALPHA PLATING');
    expect(await g(b, 'S.clients.length')).toBe(1);
    await g(b, 'bookCheck()');
    await expect.poll(() => g(b, 'S.clients.length')).toBe(2);
  });

  test('what is being typed in a dialog is kept while the other window saves, and then saves on top', async ({ page }) => {
    const b = await twoWindows(page);
    await openClients(page);
    await openClients(b);
    await b.locator('.inv-toolbar [data-action="invAddClient"]').click();
    await b.locator('#ceditName').fill('BETA PRESS');

    await addClient(page, 'ALPHA PLATING');
    await expect.poll(() => g(b, 'S.clients.length')).toBe(2);
    await expect(b.locator('.inv-toast')).toContainText('What you are typing here is kept');
    await expect(b.locator('#ceditName')).toHaveValue('BETA PRESS');

    await b.locator('[data-action="invSaveClient"][data-mode="add"]').click();
    await expect(b.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect(await storedNames(page)).toEqual(['ALPHA PLATING', 'BETA PRESS', 'EXISTING CLIENT']);
  });

  test('GitHub: pushes hold one lock across windows, and a push of the same book drops the other window\'s pending one', async ({ page }) => {
    const b = await twoWindows(page);
    await g(b, '_ghPushTimer = setTimeout(function(){ window.__pushed = true; }, 600000)');
    await g(page, 'bookPost({ type: "pushed", rev: _diskRev })');
    await expect.poll(() => g(b, '_ghPushTimer')).toBeNull();

    // The lock serialises: the second push starts only when the first has finished.
    const order = await g(page, `(async function() {
      var log = [], real = ghPush;
      ghPush = function(o) { log.push('start ' + o.n); return new Promise(function(r) { setTimeout(function() { log.push('end ' + o.n); r(true); }, 50); }); };
      await Promise.all([ghPushLocked({ n: 1 }), ghPushLocked({ n: 2 })]);
      ghPush = real;
      return log.join(', ');
    })()`);
    expect(order).toBe('start 1, end 1, start 2, end 2');
  });
});
