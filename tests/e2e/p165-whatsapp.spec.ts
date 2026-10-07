import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, type SepState } from './fixtures';

// P165 (owner, 7 Oct 2026): "When connected to the internet let's have a webpage loader in the app where it can directly
// open the web.whatsapp.com page or the installed app for us." WhatsApp Web refuses to be framed by another site
// (frame-ancestors), so it opens in its own window or the installed app, from beside each paste box, and only online.

function book(): SepState { const s: any = emptyState(); s.incomingMaterial = noSeedIM(); return s; }
const g = (page: any, e: string) => page.evaluate((x: string) => (0, eval)(x), e);

test.describe('P165 WhatsApp opened from the paste boxes', () => {
  test('the phone opens the installed app, from Add, Paste message and Today', async ({ page }) => {
    await loadAppWithState(page, book());
    // Pixel 5 is an Android phone: the app by its package, which Chrome sends to the Play Store when it is missing.
    const today = page.locator('#homeNeeds [data-tdy-wa] [data-wa-go]');
    await expect(today).toHaveCount(1);
    await expect(today).toHaveAttribute('href', /^intent:.*package=com\.whatsapp;end$/);
    await expect(today).toHaveText('Open WhatsApp');
    await expect(today).toBeVisible();

    await g(page, 'addOpen()');
    await expect(page.locator('[data-add-sheet] [data-wa="add"] [data-wa-go="app"]')).toBeVisible();
    await g(page, 'addClose()');

    await switchTab(page, 'pageStaff');
    await g(page, 'relayOpen("")');
    await expect(page.locator('[data-wa="paste"] [data-wa-go="app"]')).toBeVisible();
  });

  test('each device gets its own door: an iPhone the scheme, a computer the web page in one named window and the desktop app', async ({ page }) => {
    await loadAppWithState(page, book());
    const as = (ua: string, touch = 0) => g(page, `(function () {
      Object.defineProperty(navigator, 'userAgent', { value: ${JSON.stringify(ua)}, configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: ${touch}, configurable: true });
      return waLinks(); })()`);
    expect(await as('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toEqual([['app', 'Open WhatsApp', 'whatsapp://']]);
    expect((await as('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))[0][2]).toBe('whatsapp://');   // an iPad says Macintosh
    expect(await as('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0')).toEqual([['web', 'WhatsApp Web', 'https://web.whatsapp.com/'], ['app', 'Desktop app', 'whatsapp://']]);
    const html: string = await g(page, `waLinksHtml('x')`);
    expect(html).toContain('href="https://web.whatsapp.com/" target="sepWhatsApp"');
  });

  test('offline the links hide and say why; back online they return in place', async ({ page, context }) => {
    await loadAppWithState(page, book());
    const link = page.locator('#homeNeeds [data-tdy-wa] [data-wa-go]');
    const off = page.locator('#homeNeeds [data-tdy-wa] [data-wa-off]');
    await expect(link).toBeVisible();
    await expect(off).toBeHidden();
    await context.setOffline(true);
    await expect(link).toBeHidden();
    await expect(off).toBeVisible();
    await expect(off).toHaveText('Offline: WhatsApp opens once you are online');
    // Drawn while offline, a box starts hidden too.
    await g(page, 'addOpen()');
    await expect(page.locator('[data-add-sheet] [data-wa-go]')).toBeHidden();
    await expect(page.locator('[data-add-sheet] [data-wa-off]')).toBeVisible();
    await context.setOffline(false);
    await expect(page.locator('[data-add-sheet] [data-wa-go]')).toBeVisible();
    await expect(link).toBeVisible();
  });
});
