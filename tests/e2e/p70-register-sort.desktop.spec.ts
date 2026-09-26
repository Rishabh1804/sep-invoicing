import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { HIGH_FIRST, sortState } from './p70-register-sort.fixture';

test('desktop: the Invoice column head sorts by number, both ways', async ({ page }) => {
  await loadAppWithState(page, sortState());
  await switchTab(page, 'pageRegister');
  await page.locator('#regMonthFilter').fill('');
  await page.locator('#regMonthFilter').dispatchEvent('change');
  const head = page.locator('#regMaster button[data-action="invDesktopSort"][data-col="number"]');
  const order = () => page.locator('#regMaster tbody tr').evaluateAll(rows => rows.map(r => {
    const b = r.querySelector('[data-invnum], .inv-id'); return b ? b.textContent!.trim() : '';
  }));
  await head.click();
  await expect(head.locator('xpath=..')).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(order).toEqual(HIGH_FIRST);
  await head.click();
  await expect(head.locator('xpath=..')).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(order).toEqual([...HIGH_FIRST].reverse());
});
