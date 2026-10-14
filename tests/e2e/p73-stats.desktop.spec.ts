import { test, expect } from '@playwright/test';
import { loadAppWithState, openStatsTab } from './fixtures';
import { longBook } from './load-fixture';

// P73 (desktop): Stats' panels two across. A half panel fills the gap beside another (inv-panels-dense), so on By client the
// challan forecast and Concentration share a row though wide cards stand between them in the order; a wide card spans both
// columns. (Billing's Output tax and Invoice states were the example until the tab map, TM2b, moved them to their homes.)

test('P73 desktop: half panels sit side by side, wide ones span the row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, longBook());
  await openStatsTab(page, 'clients');
  const [next, conc, revenue] = await Promise.all(['next', 'concentration', 'revenue'].map((c) => page.locator(`#statsContent [data-card="${c}"]`).boundingBox()));
  expect(next && conc && revenue).toBeTruthy();
  expect(Math.abs(next!.y - conc!.y)).toBeLessThan(2);
  expect(Math.abs(next!.x - conc!.x)).toBeGreaterThan(next!.width - 1);
  expect(revenue!.width).toBeGreaterThan(next!.width * 1.9);
});
