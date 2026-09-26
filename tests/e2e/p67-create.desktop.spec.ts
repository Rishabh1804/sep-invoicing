import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P67 desktop: the lines read as a table: a column head, and each line's fields on one row.
test('lines sit in one row under a column head', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('dilip');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('[data-action="invCreatePickChallan"]').check();
  await expect(page.locator('.inv-lines-head')).toBeVisible();
  const tops = await page.locator('.inv-line').first().locator('input, select').evaluateAll(
    els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});
