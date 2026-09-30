import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

// P106 (desktop): a change made on a client's cards from the edit sheet reaches the pane beside the list, and the sheet
// stays open. It used to close the sheet on Add rate, and a Save made while the pane was on another client left it there.
test('C9: a card entry added from the sheet shows in the pane, and the sheet stays', async ({ page }) => {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'KILO WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true,
    rates: [{ ratePerKg: 14, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();
  await page.locator('#clientList [data-action="invSelectClientRow"]').first().click();
  await page.locator('#clientsDetail [data-action="invEditClient"]').click();
  await page.locator('#ceditNewRate').fill('16');
  await page.locator('[data-action="invAddRate"]').click();
  await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
  await expect(page.locator('#clientsDetail')).toContainText('₹16.00/kg');
  await expect(page.locator('#clientList')).toContainText('₹16.00');
});
