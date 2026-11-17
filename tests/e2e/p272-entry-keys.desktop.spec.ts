import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, readStoredState } from './fixtures';
import { longBook } from './load-fixture';

// P272: entering several at a sitting by the keyboard (owner: bugs "mostly based on navigation when entering data"). After a save,
// or in a dialog filled cell after cell, the cursor is where the next entry is typed, and Enter goes on. Made-up book (HR-10).

test('Stock by hand: after Save the cursor is back on the first quantity, and the list just saved stays in sight', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  const first = page.locator('#stockContent [data-flow] [data-stock-qty]').first();
  await first.fill('5');
  await page.locator('.inv-actionbar .inv-btn-primary').first().click();
  await expect(page.locator('#stockDayEntries')).toBeVisible();
  const y = await page.evaluate(() => window.scrollY);
  await expect(page.locator('#stockContent [data-flow] [data-stock-qty]').first()).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  // The next entry is typed straight in.
  await page.keyboard.type('7');
  await expect(page.locator('#stockContent [data-flow] [data-stock-qty]').first()).toHaveValue('7');
});
