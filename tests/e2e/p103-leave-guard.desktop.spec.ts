import { test, expect } from '@playwright/test';
import { answerAsk, loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P103 desktop: the sidebar leaves the screen, so unsaved work asks first there too.
test('a sidebar entry asks before leaving a typed challan', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').click();
  await page.locator('#imVehicleNo').fill('JH 05 1234');
  await page.locator('.inv-side-item[data-tab="pageStats"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('Leave without saving?');
  await expect(page.locator('#imVehicleNo')).toHaveValue('JH 05 1234');
  await page.locator('.inv-side-item[data-tab="pageStats"]').click();
  await answerAsk(page, 'ok');
  await expect(page.locator('#pageStats')).toHaveClass(/inv-page-active/);
});
