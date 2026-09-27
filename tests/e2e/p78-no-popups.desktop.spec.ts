import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, answerAsk } from './fixtures';
import { partState, partStateBilled } from './p77-part-invoice.fixture';

// P78 on the desktop: the in-app question is a centred dialog over the page (the phone's is a sheet), it hands
// focus back to what opened it, and the reason pickers sit under their line in the table-like line editor.

test('the in-app question is centred, and focus goes back to the button that asked', async ({ page }) => {
  await loadAppWithState(page, partState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-im="IM-401"]').first().click();
  const del = page.locator('#imDetailPane [data-action="invDeleteChallan"][data-id="IM-401"], .inv-pane [data-action="invDeleteChallan"][data-id="IM-401"]').first();
  await del.click();
  const dlg = page.locator('[data-ui-ask]');
  await expect(dlg).toBeVisible();
  const box = await dlg.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(Math.abs((box!.x + box!.width / 2) - vw / 2)).toBeLessThan(40);
  await answerAsk(page, 'cancel');
  await expect(del).toBeFocused();
});

test('the over-bill and unit reasons sit under their line on the desktop', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('samarth');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('[data-action="invCreatePickChallan"][data-id="IM-301"]').check();
  await page.locator('input[data-field="qty"][data-idx="0"]').fill('130');
  const over = page.locator('#invImShare0 [data-ack="over"]');
  await expect(over).toBeVisible();
  const lineBox = await page.locator('.inv-line').first().boundingBox();
  const overBox = await over.boundingBox();
  expect(overBox!.y).toBeGreaterThan(lineBox!.y);
  expect(overBox!.x + overBox!.width).toBeLessThanOrEqual(lineBox!.x + lineBox!.width + 1);
  await page.locator('select[data-field="unit"][data-idx="0"]').selectOption('KG');
  await expect(page.locator('#invImShare0 [data-ack="unit"]')).toBeVisible();
  await expect(over).toHaveCount(0);
});
