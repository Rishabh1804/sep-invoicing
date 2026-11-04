import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, openStockSpend } from './fixtures';
import { longBook } from './load-fixture';

// P230 on the desktop (UI pass 3 §11a, §11b): the preview stands to the right of the steps and stays in view as they scroll; Spend
// and prices takes the room beside a narrow list. Made-up names (HR-10).

test('the preview stands beside the steps and stays in view while they scroll', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  const steps = page.locator('[data-flow="stockManual"] .inv-flow-steps'), pv = page.locator('[data-flow="stockManual"] [data-flow-preview]');
  const [s, p] = [await steps.boundingBox(), await pv.boundingBox()];
  expect(p!.x).toBeGreaterThan(s!.x + s!.width - 1);
  expect(Math.abs(p!.y - s!.y)).toBeLessThan(4);
  expect(await pv.evaluate(el => getComputedStyle(el).position)).toBe('sticky');
});

test('Spend and prices: the list a narrow column of names and status, the cards a board beside it', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStock');
  await openStockSpend(page);
  expect(new URL(page.url()).searchParams.get('v')).toBe('spend');
  await expect(page.locator('#stockMasterDetail')).toHaveAttribute('data-wide-pane', '');
  const cards = page.locator('#stockSpend > .inv-panel[data-dash-section]');
  await expect(cards).toHaveCount(3);
  // Two cards side by side, the price trend across under them.
  const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  // A line opened gives the room back to the list.
  await page.locator('#stockLines [data-action="invStockOpen"]').first().click();
  await expect(page.locator('#stockMasterDetail')).not.toHaveAttribute('data-wide-pane', '');
});
