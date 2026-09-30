import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

// P113: what the code review of the QA sweep (30 Sep 2026) found in the sweep's own fixes.
const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const N2W = { id: 3, name: 'N2W TEST WORKS', billingMode: 'nos_to_weight', gstType: 'intra', gstin: '', address: '', isActive: true,
  rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] };
const book = () => { const s: any = emptyState(); s.clients = [...s.clients, N2W]; s.incomingMaterial = noSeedIM(); s.partWeights = { 'TEST N2W': 0.5 }; return s; };

test("a rate typed on a challan line is the operator's, as on the invoice", async ({ page }) => {
  // Both forms price through linePrice, and only the invoice form marked a typed rate: on the challan form the card
  // rate replaced it, the field still showing what was typed.
  await loadAppWithState(page, book());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await g(page, `_challanForm.clientId = 3; _challanForm.items = [{ partNumber: 'TEST N2W', desc: 'TEST N2W', hsn: '998873', unit: 'NOS',
    qty: 100, rate: 13, amount: 650, nosQty: null, _auto: {} }]; renderAddChallanForm();`);
  const rate = page.locator('#imAddForm input[data-field="rate"][data-idx="0"]');
  await rate.fill('15');
  await rate.dispatchEvent('change');
  await page.locator('#imAddForm input[data-field="qty"][data-idx="0"]').fill('200');
  await page.locator('#imAddForm input[data-field="qty"][data-idx="0"]').dispatchEvent('change');
  expect(await g(page, '_challanForm.items[0].rate')).toBe(15);
  expect(await g(page, '_challanForm.items[0].amount')).toBe(1500);
});
