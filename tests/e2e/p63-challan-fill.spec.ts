import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P63: a challan line filled from the record, and a reason for a red flag (docs/FINANCE_INTELLIGENCE_SPEC.md,
// side track A). Owner, 26 Sep 2026: "When I select C-Clamp 66x42(30x6) as we know all its value and std
// weight and rate, fill that out automatically … if the change for the final amount is more than the
// conditions we have for matches which raises a red flag then ask for a reason." Names and figures are made up.

function state(): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 1, name: 'KILO WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 14, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
      pieceWeights: [{ partNumber: 'BRKT 9', gauge: '', kgPerPiece: 0.448, effectiveFrom: '2020-04-01' }] },
    { id: 2, name: 'PIECE PLANT', billingMode: 'piece', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
      pieceRates: [{ partNumber: 'C-CLAMP 66X42', gauge: '30X6', rate: 1.49, effectiveFrom: '2020-04-01' }],
      pieceWeights: [{ partNumber: 'C-CLAMP 66X42', gauge: '30X6', kgPerPiece: 0.182, effectiveFrom: '2020-04-01' }] },
  ];
  // Numbered ids, as the real Items Master has: the option hands the id back through parseInt.
  s.items = [
    { id: 101, partNumber: 'C-CLAMP 66X42', desc: 'C-Clamp', gauge: '30X6', unit: 'NOS', hsn: '998873', stdWeightKg: 0.18 },
    { id: 102, partNumber: 'BRKT 9', desc: 'Bracket', unit: 'KG', hsn: '998873' },
  ];
  return s;
}

const line = (page: Page, field: string) => page.locator(`[data-action="invUpdateChallanLine"][data-field="${field}"][data-idx="0"]`);

async function openChallan(page: Page, client: string, part: string) {
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill(client);
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  await page.locator('#imChallanNo').fill('C-' + client.slice(0, 3));
  await page.locator('#imChallanDate').fill(todayIso());
  await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill(part);
  await page.locator('[data-action="invSelectChallanPart"]').first().click();
}
async function storedItems(page: Page) {
  return page.evaluate(async () => {
    const im = JSON.parse((await (window as any).readPersistedStateRaw()) || '{}').incomingMaterial || [];
    return im.length ? im[im.length - 1].items : [];
  });
}

test('choosing a piece part fills its rate and weight, and counting pieces fills the amount', async ({ page }) => {
  await loadAppWithState(page, state());
  await openChallan(page, 'PIECE', 'C-CLAMP');
  await expect(line(page, 'rate')).toHaveValue('1.49');
  const fill = page.locator('#imFill0');
  await expect(fill).toContainText('From the record: ₹1.49/pc');
  await expect(fill).toContainText('0.182 kg/pc (client card)');
  await line(page, 'qty').fill('1000');
  await expect(line(page, 'amount')).toHaveValue('1490.00');
  await expect(fill).toContainText('≈ 182.0 kg');
  await expect(page.locator('#imFlag0 [data-flag]')).toHaveCount(0);
  await page.locator('[data-action="invSaveChallan"]').click();
  const items = await storedItems(page);
  expect(items[0]).toMatchObject({ partNumber: 'C-CLAMP 66X42', unit: 'NOS', qty: 1000, rate: 1.49, amount: 1490 });
  expect(items[0].flagReason).toBeUndefined();
});

test('an amount past the red flag cannot be saved until a reason is picked, and the reason is kept with its verdict', async ({ page }) => {
  await loadAppWithState(page, state());
  await openChallan(page, 'PIECE', 'C-CLAMP');
  await line(page, 'qty').fill('1000');
  await line(page, 'amount').fill('1800');     // ₹1.80/pc against ₹1.49: 20.8% and ₹310 at stake
  await expect(page.locator('#imFlag0 [data-flag]')).toContainText('₹1.80 against ₹1.49');
  await page.locator('[data-action="invSaveChallan"]').click();
  expect(await storedItems(page)).toHaveLength(0);
  await page.locator('[data-action="invFlagReason"][data-idx="0"][data-reason="challan"]').click();
  await expect(page.locator('[data-action="invFlagReason"][data-reason="challan"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="invFlagNote"][data-idx="0"]').fill('Their challan prices it at 1.80');
  await page.locator('[data-action="invSaveChallan"]').click();
  const items = await storedItems(page);
  expect(items[0]).toMatchObject({ amount: 1800, rate: 1.8, flagReason: 'challan', flagNote: 'Their challan prices it at 1.80' });
  expect(items[0].flagAt).toMatchObject({ kind: 'rate', status: 'check', ref: 1.49, value: 1.8 });
});

test('a difference under the flag saves without a reason', async ({ page }) => {
  await loadAppWithState(page, state());
  await openChallan(page, 'PIECE', 'C-CLAMP');
  await line(page, 'qty').fill('100');
  await line(page, 'amount').fill('155');      // ₹1.55/pc: 4%, ₹6 at stake — Differs
  await expect(page.locator('#imFlag0 [data-flag]')).toHaveCount(0);
  await page.locator('[data-action="invSaveChallan"]').click();
  expect((await storedItems(page))[0]).toMatchObject({ amount: 155 });
});

test('pieces on a weight line fill the kilograms from kg/pc, never over a figure typed', async ({ page }) => {
  await loadAppWithState(page, state());
  await openChallan(page, 'KILO', 'BRKT 9');
  await expect(page.locator('#imFill0')).toContainText('0.448 kg/pc (client card)');
  await line(page, 'nosQty').fill('100');
  await expect(line(page, 'qty')).toHaveValue('44.800');
  await expect(line(page, 'amount')).toHaveValue('627.20');
  await line(page, 'qty').fill('50');           // typed: 50 kg against 49.28 for 110 pcs is within ±3%
  await line(page, 'nosQty').fill('110');
  await expect(line(page, 'qty')).toHaveValue('50');
  await expect(page.locator('#imFlag0 [data-flag]')).toHaveCount(0);
});
