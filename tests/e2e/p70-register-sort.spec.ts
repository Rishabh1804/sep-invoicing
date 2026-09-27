import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { HIGH_FIRST, sortState } from './p70-register-sort.fixture';

test('phone: the register sorts by invoice number, grouped by series, and remembers it', async ({ page }) => {
  await loadAppWithState(page, sortState());
  await switchTab(page, 'pageRegister');
  await page.locator('#regMonthFilter').fill('');
  await page.locator('#regMonthFilter').dispatchEvent('change');
  const order = () => page.locator('#regList [data-invnum]').allInnerTexts();
  await expect.poll(order).toHaveLength(5);

  await page.locator('[data-action="invRegSortBy"]').click();
  await expect(page.locator('[data-action="invRegSortBy"]')).toHaveText('By number');
  await expect(page.locator('[data-action="invRegToggleSort"]')).toHaveText('Highest first');
  await expect.poll(order).toEqual(HIGH_FIRST);
  await expect(page.locator('#regList .inv-row-group').first()).toContainText('SEP/26-27 · 4');

  await page.locator('[data-action="invRegToggleSort"]').click();
  await expect(page.locator('[data-action="invRegToggleSort"]')).toHaveText('Lowest first');
  await expect.poll(order).toEqual([...HIGH_FIRST].reverse());

  // Kept on the device: a reload opens on the same order.
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await switchTab(page, 'pageRegister');
  await expect.poll(order).toEqual([...HIGH_FIRST].reverse());

  // Back to the date: newest raised first, under day headings.
  await page.locator('[data-action="invRegSortBy"]').click();
  await expect(page.locator('[data-action="invRegSortBy"]')).toHaveText('By date');
  await expect(page.locator('[data-action="invRegToggleSort"]')).toHaveText('Oldest first');
});
