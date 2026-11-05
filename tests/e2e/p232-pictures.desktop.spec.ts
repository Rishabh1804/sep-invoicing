import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { longBook } from './load-fixture';

// P232 on the desktop (docs/UI_PASS_3.md §13): a picture page at life size where the sheet fits, the prints the action bar's, the
// picture first and the full text under its toggle. Made-up names and figures only.

test('the power case and a report lead with their pictures at life size, the prints in the action bar', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pagePower');
  await page.locator('#pagePower .inv-viewtab[data-tab="case"]').click();
  const sheet = page.locator('#powerPictureSheet');
  await expect(sheet.locator('[data-power-picture]')).toBeVisible();
  expect(await sheet.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--pp-zoom')))).toBe(1);
  const w = await sheet.locator('[data-power-picture]').evaluate(el => el.getBoundingClientRect().width);
  expect(Math.abs(w - 210 * 96 / 25.4)).toBeLessThan(2);
  await expect(page.locator('#powerContent .inv-actionbar .inv-btn')).toHaveText(['Print the full case', 'Print the picture']);
  // The picture comes before the full case on the page, and the full case is shut.
  const order = await page.locator('#powerContent').evaluate(el => Array.from(el.querySelectorAll('[data-power-picture], [data-power-case]')).map(x => x.hasAttribute('data-power-picture') ? 'picture' : 'case'));
  expect(order).toEqual(['picture', 'case']);
  await expect(page.locator('#powerCaseSheet')).toBeHidden();

  await switchTab(page, 'pageReports');
  await expect(page.locator('#rptPictureSheet [data-rpt-picture]')).toBeVisible();
  await expect(page.locator('#reportsContent .inv-actionbar .inv-btn')).toHaveText(['Print the picture and the report', 'Print the picture']);
  await expect(page.locator('#rptSheet')).toBeHidden();
  // The page never scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
