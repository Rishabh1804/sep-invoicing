import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P78: a client's own vehicle and PO (owner, 27 Sep 2026: "Dorabji Auto generally is despatched through only one
// way of transport … so let's make it so that the field is already filled out along with PO number, which is
// usually the same as their challan number with the suffix DA1/xxxxx"). Client settings, not a hard-code:
// `defaultTransport` and `poFromChallan` (DA1/{challan:5}). The client name is the one already in SEED_CLIENTS;
// the challans, parts and figures are made up.

const DORABJI = 'DORABJI AUTO';

function state(client: Record<string, unknown> = {}, flags: Record<string, unknown> = {}): SepState {
  const s: any = emptyState();
  s.clients = [
    { id: 1, name: DORABJI, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [], ...client },
    { id: 2, name: 'OTHER TEST WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  const ch = (id: string, no: string, qty: number, vehicle = 'JH 05ZZ 1111') => ({
    id, challanNo: no, challanDate: todayIso(), clientId: 1, clientName: DORABJI, vehicleNo: vehicle,
    items: [{ id: id + '-0', partNumber: 'TEST BRACKET ' + no, desc: 'TEST BRACKET ' + no, hsn: '998873', unit: 'KG', qty, rate: 13,
      amount: qty * 13, nosQty: null, invoiced: false, invoiceId: null }],
    receivedDate: todayIso(), notes: '', createdAt: recentTs(),
  });
  s.incomingMaterial = [ch('IM-1244', '1244', 40), ch('IM-1250', '1250', 25)];
  Object.assign(s, flags);
  return s;
}

async function chooseClient(page: Page, q: string) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill(q);
  await page.locator('[data-action="invSelectClient"]').first().click();
}
const tick = (page: Page, id: string) => page.locator(`[data-action="invCreatePickChallan"][data-id="${id}"]`);
const po = (page: Page) => page.locator('#invPONumber');
const ve = (page: Page) => page.locator('#invTransport');

test('the settings are seeded on DORABJI AUTO once, only where both are empty', async ({ page }) => {
  await loadAppWithState(page, state());
  let c = (await readStoredState(page)).clients[0];
  expect(c).toMatchObject({ defaultTransport: 'JH 05DN 6730', poFromChallan: 'DA1/{challan:5}' });
  expect((await readStoredState(page))._clientDocDefaults1).toBe(true);

  // A value the owner typed is never touched, nor its empty partner filled.
  await loadAppWithState(page, state({ defaultTransport: 'JH 05ZZ 9999' }));
  c = (await readStoredState(page)).clients[0];
  expect(c.defaultTransport).toBe('JH 05ZZ 9999');
  expect(c.poFromChallan || '').toBe('');

  // Once: a book that has run it (the flag travels with it) keeps the fields as the owner left them.
  await loadAppWithState(page, state({}, { _clientDocDefaults1: true }));
  c = (await readStoredState(page)).clients[0];
  expect(c.defaultTransport || '').toBe('');
  expect(c.poFromChallan || '').toBe('');
});

test('a new invoice takes the vehicle and a PO made from the challan, following the challans ticked', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'dorabji');
  await expect(ve(page)).toHaveValue('JH 05DN 6730');
  await expect(page.locator('[data-client-default="ve"]')).toHaveText(`Filled from ${DORABJI}’s settings`);
  await expect(po(page)).toHaveValue('');
  await expect(page.locator('[data-client-default="po"]')).toContainText('Fills from the challan number once one is cited');

  await tick(page, 'IM-1244').check();
  await expect(po(page)).toHaveValue('DA1/01244');
  await expect(page.locator('[data-client-default="po"]')).toHaveText(`Challan 1244 as DA1/{challan:5}, from ${DORABJI}’s settings`);
  // The challans' own vehicle does not replace the client's.
  await expect(ve(page)).toHaveValue('JH 05DN 6730');

  await tick(page, 'IM-1250').check();
  await expect(page.locator('#invChallanNo')).toHaveValue('1244, 1250');
  await expect(po(page)).toHaveValue('DA1/01244');
  await expect(page.locator('[data-client-default="po"]')).toContainText('the first of 2 challans');

  await tick(page, 'IM-1244').uncheck();
  await expect(po(page)).toHaveValue('DA1/01250');

  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  expect((await readStoredState(page)).invoices[0]).toMatchObject({ poNumber: 'DA1/01250', transport: 'JH 05DN 6730', challanNo: '1250' });
});

test('a value typed on the invoice is the operator\'s for good', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'dorabji');
  await tick(page, 'IM-1244').check();
  await po(page).fill('DA1/09999');
  await ve(page).fill('JH 05ZZ 4242');
  await tick(page, 'IM-1250').check();
  await expect(po(page)).toHaveValue('DA1/09999');
  await expect(ve(page)).toHaveValue('JH 05ZZ 4242');
  await expect(page.locator('[data-client-default="po"]')).toContainText(`Typed here; ${DORABJI}’s settings would give DA1/01244`);
});

test('a challan number typed by hand moves an auto PO in place', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'dorabji');
  await page.locator('#invChallanNo').fill('0877/26-27');
  await page.locator('#invChallanNo').press('Tab');
  await expect(po(page)).toHaveValue('DA1/00877');
});

test('IM → Create invoice fills them too', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageIM');
  // The selection is a top-level `let`, so it is reached by name, as the tick box's handler reaches it.
  await page.evaluate(() => (0, eval)("_imSelected['IM-1250-0'] = true; createInvoiceFromIM()"));
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(po(page)).toHaveValue('DA1/01250');
  await expect(ve(page)).toHaveValue('JH 05DN 6730');
});

test('another client keeps its prediction, and an edit is left alone', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'other');
  await expect(po(page)).toHaveValue('');
  await expect(ve(page)).toHaveValue('');
  await expect(page.locator('[data-client-default]')).toHaveCount(0);
});

test('the settings are edited on the client, with a live example and a pattern that must name the number', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageClients');
  await page.evaluate(() => (window as any).openClientEdit(1));
  const sheet = page.locator('[data-client-defaults]');
  await expect(sheet.locator('#ceditTransport')).toHaveValue('JH 05DN 6730');
  await expect(sheet.locator('#ceditPoTpl')).toHaveValue('DA1/{challan:5}');
  await expect(sheet.locator('#ceditPoEx')).toHaveText(/^Challan 12(44|50) gives DA1\/012(44|50)\.$/);
  await sheet.locator('#ceditPoTpl').fill('PO-{challan}');
  await expect(sheet.locator('#ceditPoEx')).toHaveText(/gives PO-12(44|50)\.$/);
  await sheet.locator('#ceditPoTpl').fill('PO-');
  await expect(sheet.locator('#ceditPoEx')).toContainText('Put {challan} where the number goes');
  await page.locator('[data-action="invSaveClient"]').click();
  await expect(page.locator('.inv-toast')).toContainText('The P.O. pattern needs {challan}');
  await sheet.locator('#ceditPoTpl').fill('DA2/{challan:6}');
  await sheet.locator('#ceditTransport').fill('jh 05zz 7777');
  await page.locator('[data-action="invSaveClient"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Client saved');
  expect((await readStoredState(page)).clients[0]).toMatchObject({ defaultTransport: 'JH 05ZZ 7777', poFromChallan: 'DA2/{challan:6}' });

  await chooseClient(page, 'dorabji');
  await tick(page, 'IM-1244').check();
  await expect(po(page)).toHaveValue('DA2/001244');
  await expect(ve(page)).toHaveValue('JH 05ZZ 7777');
});
