import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P78: a client's own vehicle and PO (owner, 27 Sep 2026: "[A client] generally is despatched through only one way of
// transport … so let's make it so that the field is already filled out along with PO number, which is usually the same as
// their challan number with [their prefix]"). Client settings, not a hard-code: `defaultTransport` and `poFromChallan`
// (here QX1/{challan:5}). The client, its vehicle, the challans, parts and figures are made up: the build holds no client
// (data.js; owner, 22 Oct 2026), so the settings are typed on the client, never written by the app.

const CLIENT = 'DELTA AUTO';
const VEHICLE = 'JH 05ZZ 6060';
const PATTERN = 'QX1/{challan:5}';

function state(client: Record<string, unknown> = {}, flags: Record<string, unknown> = {}): SepState {
  const s: any = emptyState();
  s.clients = [
    { id: 1, name: CLIENT, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
      defaultTransport: VEHICLE, poFromChallan: PATTERN, ...client },
    { id: 2, name: 'OTHER TEST WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  const ch = (id: string, no: string, qty: number, vehicle = 'JH 05ZZ 1111') => ({
    id, challanNo: no, challanDate: todayIso(), clientId: 1, clientName: CLIENT, vehicleNo: vehicle,
    items: [{ id: id + '-0', partNumber: 'TEST BRACKET ' + no, desc: 'TEST BRACKET ' + no, hsn: '998873', unit: 'KG', qty, rate: 13,
      amount: qty * 13, nosQty: null, invoiced: false, invoiceId: null }],
    receivedDate: todayIso(), notes: '', createdAt: recentTs(),
  });
  s.incomingMaterial = [ch('IM-1246', '1246', 40), ch('IM-1250', '1250', 25)];
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

test('the app writes no client’s vehicle or P.O. pattern on its own: they are the client’s settings', async ({ page }) => {
  // A once-only migration used to set them on one client by name, its vehicle and pattern written into the build. It is
  // gone (22 Oct 2026): a book that never ran it starts with both empty and stays so, and the flag it always set is never
  // set again. A book that ran it keeps what it wrote (the settings are the client's, in the book).
  await loadAppWithState(page, state({ defaultTransport: '', poFromChallan: '' }));
  const st = await readStoredState(page);
  for (const c of st.clients) {
    expect(c.defaultTransport || '').toBe('');
    expect(c.poFromChallan || '').toBe('');
  }
  expect(st._clientDocDefaults1).toBeUndefined();

  await chooseClient(page, 'delta');
  await expect(ve(page)).toHaveValue('');
  await expect(po(page)).toHaveValue('');
  await expect(page.locator('[data-client-default]')).toHaveCount(0);
});

test('a new invoice takes the vehicle and a PO made from the challan, following the challans ticked', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'delta');
  await expect(ve(page)).toHaveValue(VEHICLE);
  await expect(page.locator('[data-client-default="ve"]')).toHaveText(`Filled from ${CLIENT}’s settings`);
  await expect(po(page)).toHaveValue('');
  await expect(page.locator('[data-client-default="po"]')).toContainText('Fills from the challan number once one is cited');

  await tick(page, 'IM-1246').check();
  await expect(po(page)).toHaveValue('QX1/01246');
  await expect(page.locator('[data-client-default="po"]')).toHaveText(`Challan 1246 as ${PATTERN}, from ${CLIENT}’s settings`);
  // The challans' own vehicle does not replace the client's.
  await expect(ve(page)).toHaveValue(VEHICLE);

  await tick(page, 'IM-1250').check();
  await expect(page.locator('#invChallanNo')).toHaveValue('1246, 1250');
  await expect(po(page)).toHaveValue('QX1/01246');
  await expect(page.locator('[data-client-default="po"]')).toContainText('the first of 2 challans');

  await tick(page, 'IM-1246').uncheck();
  await expect(po(page)).toHaveValue('QX1/01250');

  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  expect((await readStoredState(page)).invoices[0]).toMatchObject({ poNumber: 'QX1/01250', transport: VEHICLE, challanNo: '1250' });
});

test('a value typed on the invoice is the operator\'s for good', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'delta');
  await tick(page, 'IM-1246').check();
  await po(page).fill('QX1/09999');
  await ve(page).fill('JH 05ZZ 4242');
  await tick(page, 'IM-1250').check();
  await expect(po(page)).toHaveValue('QX1/09999');
  await expect(ve(page)).toHaveValue('JH 05ZZ 4242');
  await expect(page.locator('[data-client-default="po"]')).toContainText(`Typed here; ${CLIENT}’s settings would give QX1/01246`);
});

test('a challan number typed by hand moves an auto PO in place', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page, 'delta');
  await page.locator('#invChallanNo').fill('0877/26-27');
  await page.locator('#invChallanNo').press('Tab');
  await expect(po(page)).toHaveValue('QX1/00877');
});

test('IM → Create invoice fills them too', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageIM');
  // The selection is a top-level `let`, so it is reached by name, as the tick box's handler reaches it.
  await page.evaluate(() => (0, eval)("_imSelected['IM-1250-0'] = true; createInvoiceFromIM()"));
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(po(page)).toHaveValue('QX1/01250');
  await expect(ve(page)).toHaveValue(VEHICLE);
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
  await expect(sheet.locator('#ceditTransport')).toHaveValue(VEHICLE);
  await expect(sheet.locator('#ceditPoTpl')).toHaveValue(PATTERN);
  await expect(sheet.locator('#ceditPoEx')).toHaveText(/^Challan 12(46|50) gives QX1\/012(46|50)\.$/);
  await sheet.locator('#ceditPoTpl').fill('PO-{challan}');
  await expect(sheet.locator('#ceditPoEx')).toHaveText(/gives PO-12(46|50)\.$/);
  await sheet.locator('#ceditPoTpl').fill('PO-');
  await expect(sheet.locator('#ceditPoEx')).toContainText('Put {challan} where the number goes');
  await page.locator('[data-action="invSaveClient"]').click();
  await expect(page.locator('.inv-toast')).toContainText('The P.O. pattern needs {challan}');
  await sheet.locator('#ceditPoTpl').fill('QX2/{challan:6}');
  await sheet.locator('#ceditTransport').fill('jh 05zz 7777');
  await page.locator('[data-action="invSaveClient"]').click();
  await expect(page.locator('.inv-toast')).toContainText('Client saved');
  expect((await readStoredState(page)).clients[0]).toMatchObject({ defaultTransport: 'JH 05ZZ 7777', poFromChallan: 'QX2/{challan:6}' });

  await chooseClient(page, 'delta');
  await tick(page, 'IM-1246').check();
  await expect(po(page)).toHaveValue('QX2/001246');
  await expect(ve(page)).toHaveValue('JH 05ZZ 7777');
});
