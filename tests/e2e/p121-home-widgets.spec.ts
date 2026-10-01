import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openPulse } from './fixtures';

// P121 (owner, 30 Sep 2026): Home is widgets the owner arranges, from a preset (Owner, Floor, Money) and in an edit mode:
// shown or hidden, up and down, half or full; kept on this device, never in the book. Made-up names.

const order = (p: Page) => p.locator('#homeWidgets > [data-home-w]:not(.inv-hidden)').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.homeW));
function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', aliases: [], unit: 'L', active: true, createdAt: 1 }],
    entries: [{ id: 'SE0', itemId: 'N', kind: 'count', qty: 0, date: todayIso(), seq: 0, at: 1, source: 'manual', by: 'X' }], pastes: [] };
  return s as SepState;
}

test('the Owner preset is the Home there was; Floor and Money are one tap; the choice stays on this device', async ({ page }) => {
  await loadAppWithState(page, book());
  await openPulse(page);
  expect((await order(page)).slice(0, 2)).toEqual(['mtd', 'quick']);
  await expect(page.locator('#homeWidgets [data-home-w="stock"]')).toHaveClass(/inv-hidden/);
  await page.locator('[data-action="invHomeEdit"]').click();
  await page.locator('[data-action="invHomePreset"][data-preset="floor"]').click();
  expect((await order(page)).slice(0, 3)).toEqual(['quick', 'attendance', 'production']);
  await expect(page.locator('#homeStockCard')).toContainText('Nitric acid');
  await page.locator('[data-action="invHomeEditDone"]').click();
  await page.reload();
  await page.waitForSelector('body.inv-booted');
  expect((await order(page))[0]).toBe('quick');
  // Never in the book.
  expect(JSON.stringify(await readStoredState(page))).not.toMatch(/"preset"|"homeLayout"/);
});

test('in the edit mode a widget is hidden, moved and set full width, and the layout reads as your own', async ({ page }) => {
  await loadAppWithState(page, book());
  await openPulse(page);
  await page.locator('[data-action="invHomeEdit"]').click();
  await page.locator('[data-home-show="quick"]').uncheck();
  await expect(page.locator('#homeWidgets [data-home-w="quick"]')).toHaveClass(/inv-hidden/);
  await page.locator('[data-action="invHomeMove"][data-w="recent"][data-d="-1"]').click();
  await page.locator('[data-home-show="power"]').check();
  await page.locator('[data-action="invHomeWide"][data-w="power"][data-v="1"]').click();
  await expect(page.locator('#homeWidgets [data-home-w="power"]')).toHaveClass(/inv-panels-wide/);
  await expect(page.locator('#homePowerCard')).toContainText('This month');
  await expect(page.locator('#homeEdit')).toContainText('Your own arrangement');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_home') || '{}'));
  expect(saved.preset).toBe('custom');
  expect(saved.hidden.quick).toBe(true);
  expect(saved.order.indexOf('recent')).toBeLessThan(saved.order.indexOf('zinc'));
});
