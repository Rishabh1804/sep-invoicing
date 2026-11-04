import { test, expect } from '@playwright/test';
import { loadAppWithState, openStatsTab } from './fixtures';
import { longBook } from './load-fixture';

// P73 (desktop): Stats' cards side by side. A small card fills the gap beside another (the board packs dense since UI pass 3, U3), so
// on the Dashboard Turnaround and Days to pay share a row though a Large card stands before them in the order; a Large card spans
// the row. (By client's challan forecast and Concentration were the example until U3 made them a column and a widget; Billing's
// Output tax and Invoice states until the tab map, TM2b, moved them to their homes.)

test('P73 desktop: small cards sit side by side, large ones span the row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, longBook());
  await openStatsTab(page, 'board');
  await page.locator('#statsBoard .inv-widget[data-w="clientprice"]').waitFor();
  const [next, conc, revenue] = await Promise.all(['turn', 'dtp', 'clientprice'].map((c) => page.locator(`#statsContent .inv-widget[data-w="${c}"]`).boundingBox()));
  expect(next && conc && revenue).toBeTruthy();
  expect(Math.abs(next!.y - conc!.y)).toBeLessThan(2);
  expect(Math.abs(next!.x - conc!.x)).toBeGreaterThan(next!.width - 1);
  expect(revenue!.width).toBeGreaterThan(next!.width * 1.9);
});
