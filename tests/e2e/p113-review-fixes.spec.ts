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

test('an invoice whose stored number is not padded like its display stays in its series', async ({ page }) => {
  // '812' under 'SEP/TEST-00812' was read as series 'SEP/TEST-00', so Next could walk back onto 00812.
  await loadAppWithState(page, book());
  expect(await g(page, `invSeriesOf({ displayNumber: 'SEP/TEST-00812', invoiceNumber: '812' })`)).toBe('SEP/TEST-');
  expect(await g(page, `invSeriesOf({ displayNumber: 'SEP/2025-26/00950', invoiceNumber: '00950' })`)).toBe('SEP/2025-26/');
  expect(await g(page, `invSeriesOf({ displayNumber: 'SEP/2025-26/00950', invoiceNumber: '950' })`)).toBe('SEP/2025-26/');
});

test("a renamed worker keeps the old name as a spelling, so the slips paid under it still find them", async ({ page }) => {
  const s: any = book();
  s.staff = [{ id: 1, name: 'Bhanu', comp: 'monthly', dayRate: 500, area: 'vat-a1', active: true }];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  await page.locator('[data-action="invAttEditWorker"][data-id="1"]').click();
  await page.locator('#wedName').fill('Bhanu Pratap Sharma');
  await page.locator('[data-action="invAttSaveWorker"]').click();
  expect(await g(page, 'S.staff[0].relayNames')).toContain('BHANU');
  expect(await g(page, `(payrollWorker({ name: 'Bhanu' }) || {}).id`)).toBe(1);
});

test("two workers told apart only by a digit, or named in Devanagari, are two workers to the roster", async ({ page }) => {
  const s: any = book();
  s.staff = [{ id: 1, name: 'Ramu 1', comp: 'hourly', hourRate: 50, area: 'vat-a1', active: true },
    { id: 2, name: 'राम', comp: 'hourly', hourRate: 50, area: 'vat-a1', active: true }];
  await loadAppWithState(page, s);
  expect(await g(page, `staffNameKey('Ramu 1') === staffNameKey('Ramu 2')`)).toBe(false);
  expect(await g(page, `staffNameKey('राम') === staffNameKey('श्याम')`)).toBe(false);
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  for (const name of ['Ramu 2', 'श्याम']) {
    await page.locator('.inv-page-active [data-action="invAttAddWorker"]').first().click();
    await page.locator('#wedName').fill(name);
    await page.locator('[data-action="invAttSaveWorker"]').click();
  }
  expect(await g(page, 'S.staff.map(function(w) { return w.name; })')).toEqual(['Ramu 1', 'राम', 'Ramu 2', 'श्याम']);
});
