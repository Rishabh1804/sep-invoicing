import { test, expect } from '@playwright/test';
import { answerAsk, loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P103 desktop: the rail and the tab row leave the screen, so unsaved work asks first there too.
test('a tab of the workspace row asks before leaving a typed challan', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').click();
  await page.locator('#imVehicleNo').fill('JH 05 1234');
  // Another of Office's tabs (Stats, here until the tab map of 9 Oct 2026, is Today's now).
  await page.locator('#wsTabs [data-tab="pageRegister"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
  await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
  await page.locator('#wsTabs [data-tab="pageRegister"]').click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
});

test("a workspace's door in the rail asks before leaving a typed challan", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').click();
  await page.locator('#imVehicleNo').fill('JH 05 1234');
  await page.locator('#invSidebar [data-ws="floor"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
  await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
});
