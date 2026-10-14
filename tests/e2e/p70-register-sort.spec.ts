import { test, expect } from '@playwright/test';
import { loadAppWithState, setFilter, switchTab } from './fixtures';
import { HIGH_FIRST, sortState } from './p70-register-sort.fixture';

test('phone: the register sorts by invoice number, grouped by series, and remembers it', async ({ page }) => {
  await loadAppWithState(page, sortState());
  await switchTab(page, 'pageRegister');
  await setFilter(page, '#regMonthFilter', '');
  const order = () => page.locator('#regList [data-invnum]').allInnerTexts();
  await expect.poll(order).toHaveLength(5);
  const token = page.locator('#pageRegister .inv-token[data-clear="sort"]');

  // The sort is a choice in Filter (the tab map, TM5c), said as a token under the row.
  await setFilter(page, '#regSort', 'number-desc');
  await expect(token).toContainText('Highest number first');
  await expect.poll(order).toEqual(HIGH_FIRST);
  await expect(page.locator('#regList .inv-row-group').first()).toContainText('SEP/26-27 · 4');

  await setFilter(page, '#regSort', 'number-asc');
  await expect(token).toContainText('Lowest number first');
  await expect.poll(order).toEqual([...HIGH_FIRST].reverse());

  // Kept on the device: a reload opens on the same order.
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await switchTab(page, 'pageRegister');
  await expect.poll(order).toEqual([...HIGH_FIRST].reverse());

  // The token puts the default back: newest first, under day headings.
  await token.click();
  await expect(token).toHaveCount(0);
  expect(await page.evaluate(() => (0, eval)('regFilter.regSortBy + "-" + regFilter.regSortDir'))).toBe('date-desc');
});
