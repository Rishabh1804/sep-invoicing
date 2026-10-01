import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P132, desktop: Reports sits in the sidebar under Insights, after Stats, and the report is shown as a sheet.

test('Reports is in the sidebar after Stats, and the report is an A4-wide sheet', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  const review = page.locator('#invSidebar .inv-side-item .inv-side-label');
  const labels = await review.allInnerTexts();
  expect(labels.slice(labels.indexOf('Insights'), labels.indexOf('History') + 1)).toEqual(['Insights', 'Stats', 'Reports', 'History']);
  await switchTab(page, 'pageReports');
  const docEl = page.locator('#rptSheet [data-rpt-doc]');
  await expect(docEl.locator('.inv-rpt-title')).toContainText('Monthly report');
  const w = await docEl.evaluate(el => el.getBoundingClientRect().width);
  expect(Math.abs(w - 210 * 96 / 25.4)).toBeLessThan(2);
  // The page never scrolls sideways, and the sidebar marks the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator('#invSidebar .inv-side-item[data-tab="pageReports"]')).toHaveClass(/inv-side-item-on|active/);
});
