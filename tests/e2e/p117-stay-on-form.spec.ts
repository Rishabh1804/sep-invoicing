import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';
import { partStateBilled } from './p77-part-invoice.fixture';

// P117 (owner, 30 Sep 2026): entering by hand stays on the form for the next entry (Production, Power, Stock), what was
// entered is listed where it was entered and can be corrected, and a part-invoiced challan shows what is left to bill.
// Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];

test('Production by hand stays on the form: the kind, day, line and client carry over, and each save is listed', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState);
  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction [data-action="invProdHand"]').click();
  await page.locator('#prodHandLine').selectOption('vat-a2');
  await page.locator('#prodHandClient').selectOption('11');
  for (const [part, qty] of [['CLAMP 165X83 (40X6)', '420'], ['CLAMP 105X83 (40X6)', '300']]) {
    await page.locator('#prodHandPart').fill(part);
    await page.locator('#prodHandQty').fill(qty);
    await page.locator('[data-action="invProdSaveHand"]').click();
    await expect(page.locator('#prodHandPart')).toHaveValue('');
  }
  await expect(page.locator('#prodHandLine')).toHaveValue('vat-a2');
  await expect(page.locator('#prodHandClient')).toHaveValue('11');
  await expect(page.locator('[data-card="prodHandSaved"] [data-prod-entry]')).toHaveCount(2);
  expect((await readStoredState(page)).production.entries.map((e: any) => [e.part, e.qty, e.line])).toEqual([
    ['CLAMP 165X83 (40X6)', 420, 'vat-a2'], ['CLAMP 105X83 (40X6)', 300, 'vat-a2']]);
  // Nothing typed since the save, so Done leaves without asking.
  await page.locator('[data-card="prodHandSaved"] [data-action="invProdHandDone"]').click();
  await expect(page.locator('#pageProduction [data-action="invProdHand"]')).toBeVisible();
});

test('Power → Enter a cut takes several cuts in a row and comes back to Power', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerAddCut"]').first().click();
  for (const [from, to] of [['10:05', '10:40'], ['13:12', '13:30'], ['15:00', '']]) {
    await page.locator('#prodHandTime').fill(from);
    if (to) await page.locator('#prodHandTo').fill(to);
    await page.locator('[data-action="invProdSaveHand"]').click();
    await expect(page.locator('#prodHandTime')).toHaveValue('');
  }
  const cuts = (await readStoredState(page)).production.entries;
  expect(cuts.map((e: any) => [e.kind, e.time, e.to || null])).toEqual([['downtime', '10:05', '10:40'], ['downtime', '13:12', '13:30'], ['downtime', '15:00', null]]);
  await page.locator('.inv-pagehead [data-action="invProdHandDone"]').click();
  await expect(page.locator('#pagePower.inv-page-active')).toBeVisible();
});

test('Stock by hand stays on the day, lists what the day holds, and corrects an entry by voiding it', async ({ page }) => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', aliases: [], unit: 'L', active: true, createdAt: 1 }],
    entries: [{ id: 'SE0', itemId: 'N', kind: 'count', qty: 100, date: todayIso(), seq: 0, at: 1, source: 'manual', by: 'X' }], pastes: [] };
  await loadAppWithState(page, s);
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  await page.locator('[data-action="invStockMode"][data-mode="used"]').click();
  await page.locator('[data-stock-qty="N"]').fill('30');
  await page.locator('[data-action="invStockSaveManual"]').click();
  // Still on the form, the field cleared, the day listed with the level it left.
  await expect(page.locator('[data-stock-qty="N"]')).toHaveValue('');
  const day = page.locator('#stockDayEntries');
  await expect(day).toContainText('Used 30 L');
  await expect(day).toContainText('left 70 L');
  // Correct: the old entry is voided saying what it became, and the new one names it.
  const used = day.locator('[data-entry]').filter({ hasText: 'Used 30' });
  await used.locator('[data-action="invStockCorrect"]').click();
  await answerAsk(page, 'ok', '25');
  await expect(day).toContainText('left 75 L');
  await expect(day).toContainText('Corrected to 25 L');
  const st = (await readStoredState(page)).stock.entries;
  const old = st.find((e: any) => e.qty === 30), fix = st.find((e: any) => e.qty === 25);
  expect(old.voided.reason).toBe('Corrected to 25 L');
  expect(fix).toMatchObject({ kind: 'used', corrects: { id: old.id, qty: 30 } });
  expect(await g(page, `stockReplay('N').level`)).toBe(75);
  // Another day is checked by picking its date.
  await page.locator('#stockManDate').fill('2020-01-01');
  await page.locator('#stockManDate').dispatchEvent('change');
  await expect(day).toContainText('Nothing entered for this day yet');
});

test('a part-invoiced challan shows what is left to bill, with the whole beside it', async ({ page }) => {
  await loadAppWithState(page, partStateBilled(200, 300));
  await switchTab(page, 'pageIM');
  const row = page.locator('#pageIM [data-im="IM-301"]').first();
  await expect(row).toContainText('₹250.00');
  await expect(row).toContainText('left of ₹1,500.00');
  expect(await g(page, `imChallanOpenTotal(S.incomingMaterial.find(m => m.id === 'IM-301'))`)).toBe(250);
});

test('a challan saved with Save, add another opens the next on the same client, date and vehicle', async ({ page }) => {
  const s = emptyState();
  s.clients = s.clients.map((c: any) => ({ ...c, isActive: true }));
  (s as any).incomingMaterial = noSeedIM();
  await loadAppWithState(page, s);
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('TEST');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  await page.locator('#imChallanNo').fill('501');
  await page.locator('#imChallanDate').fill('2026-04-28');
  await page.locator('#imVehicleNo').fill('JH05 AB 1234');
  await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('BRACKET 11');
  await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').fill('40');
  await page.locator('[data-action="invSaveChallanNext"]').click();
  await expect(page.locator('#imChallanNo')).toHaveValue('');
  await expect(page.locator('#imChallanDate')).toHaveValue('2026-04-28');
  await expect(page.locator('#imVehicleNo')).toHaveValue('JH05 AB 1234');
  const saved = (await readStoredState(page)).incomingMaterial.filter((m: any) => m.challanNo === '501');
  expect(saved).toHaveLength(1);
  // The client is kept: the next line can be typed straight away and saved with the plain Save, which closes the form.
  await page.locator('#imChallanNo').fill('502');
  await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('BRACKET 12');
  await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').fill('10');
  await page.locator('[data-action="invSaveChallan"]').click();
  await expect(page.locator('#imChallanNo')).toHaveCount(0);
  const both = (await readStoredState(page)).incomingMaterial.filter((m: any) => /^50[12]$/.test(m.challanNo));
  expect(both.map((m: any) => [m.challanNo, m.clientId, m.vehicleNo])).toEqual([['501', saved[0].clientId, 'JH05 AB 1234'], ['502', saved[0].clientId, 'JH05 AB 1234']]);
});
