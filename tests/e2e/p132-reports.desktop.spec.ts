import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P132, desktop: Reports sits in Today's Insights, after Stats (the tab map, 9 Oct 2026; Office's review from 8 Oct, Insights'
// before), and the report is shown as a sheet.

test("Reports is in Today's tab row after Stats, and the report is an A4-wide sheet", async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageReports');
  const labels = await page.locator('#wsTabs .inv-viewtab').allInnerTexts();
  expect(labels.slice(labels.indexOf('Stats'))).toEqual(['Stats', 'Reports', 'Planner']);
  const docEl = page.locator('#rptSheet [data-rpt-doc]');
  await expect(docEl.locator('.inv-rpt-title')).toContainText('Monthly report');
  const w = await docEl.evaluate(el => el.getBoundingClientRect().width);
  expect(Math.abs(w - 210 * 96 / 25.4)).toBeLessThan(2);
  // The page never scrolls sideways; its tab is pressed and the rail marks Today.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator('#wsTabs [data-tab="pageReports"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#invSidebar [data-ws="today"]')).toHaveClass(/inv-side-item-on/);
});
