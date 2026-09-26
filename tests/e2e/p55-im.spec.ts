import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P55: the Challans (IM) screen on the v2.0 components. The worklist leads with material still to bill,
// the filters speak through change and never click, and the page carries one primary action.

test('material still to bill leads, grouped by day, and billed material follows', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  const heads = await page.locator('#imList .inv-panel-title').allInnerTexts();
  expect(heads.map(h => h.replace(/\s+\d+$/, ''))).toEqual(['Awaiting invoice', 'Invoiced']);
  const order = await page.locator('#imList [data-im]').evaluateAll(els => els.map(e => e.getAttribute('data-im')));
  expect(order).toEqual(['IM-102', 'IM-101', 'IM-103']);
  await expect(page.locator('#imList .inv-row-group').first()).toContainText('₹1,300.00');
});

test('the filters carry no click action, and a change filters the list', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await expect(page.locator('#imToolbar select[data-action]')).toHaveCount(0);
  await page.locator('#imStatusFilter').selectOption('invoiced');
  await expect(page.locator('#imList [data-im]')).toHaveCount(1);
  await expect(page.locator('#imList [data-im="IM-103"]')).toBeVisible();
});

test('one primary button on the page, and Add challan is reached once', async ({ page }) => {
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invToggleIM"][data-id="IM-102"]').click();
  await page.locator('[data-action="invCheckIMItem"]').first().check();
  await expect(page.locator('#pageIM .inv-btn-primary:visible')).toHaveCount(1);
  await expect(page.locator('#pageIM [data-action="invShowAddChallan"]')).toHaveCount(1);
});
