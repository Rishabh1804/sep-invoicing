import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, workingDaysBack, recentTs, answerAsk, type SepState } from './fixtures';

// P81: the P.O. date follows the challan date (owner, 27 Sep 2026: "at the time of making invoice we have to enter the
// PO date, which is redundant as almost always it's the same as challan date - that field should be prefilled as it's
// not printed on the invoice"). It follows until somebody types a different one. Names and figures are made up.

const TODAY = todayIso();
const [, , , D3, , , , D7] = workingDaysBack(8);

function state(): SepState {
  const s: any = emptyState();
  s.clients = [{ id: 1, name: 'TEST PRESS WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] }];
  const ch = (id: string, no: string, date: string) => ({
    id, challanNo: no, challanDate: date, clientId: 1, clientName: 'TEST PRESS WORKS', vehicleNo: '',
    items: [{ id: id + '-0', partNumber: 'TEST PLATE ' + no, desc: 'TEST PLATE ' + no, hsn: '998873', unit: 'KG', qty: 20, rate: 13,
      amount: 260, nosQty: null, invoiced: false, invoiceId: null }],
    receivedDate: date, notes: '', createdAt: recentTs(),
  });
  s.incomingMaterial = [ch('IM-501', '501', D3), ch('IM-502', '502', D7)];
  return s;
}

async function chooseClient(page: Page) {
  await switchTab(page, 'pageCreate');
  await page.locator('#invClientSearch').fill('test press');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('#invOptional').evaluate((d: HTMLDetailsElement) => { d.open = true; });
}
const tick = (page: Page, id: string) => page.locator(`[data-action="invCreatePickChallan"][data-id="${id}"]`);
const pd = (page: Page) => page.locator('#invPODate');
const cd = (page: Page) => page.locator('#invChallanDate');

test('the P.O. date follows the challan date — ticked or picked — and is saved with it', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page);
  await expect(pd(page)).toHaveValue(TODAY);
  await expect(page.locator('#invPoDateHint')).toContainText('Follows the challan date · not printed on the invoice');

  await tick(page, 'IM-501').check();
  await expect(cd(page)).toHaveValue(D3);
  await expect(pd(page)).toHaveValue(D3);

  // Picked by hand: it follows in place.
  await cd(page).fill(D7);
  await expect(pd(page)).toHaveValue(D7);

  await page.locator('#invSaveBtn').click();
  await expect.poll(async () => (await readStoredState(page)).invoices.length).toBe(1);
  expect((await readStoredState(page)).invoices[0]).toMatchObject({ challanDate: D7, poDate: D7 });
});

test('a P.O. date typed differently stays; clearing it hands it back to the challan date', async ({ page }) => {
  await loadAppWithState(page, state());
  await chooseClient(page);
  await tick(page, 'IM-501').check();
  await pd(page).fill(D7);
  await expect(page.locator('#invPoDateHint')).toContainText('Typed here');
  await cd(page).fill(TODAY);
  await expect(pd(page)).toHaveValue(D7);
  // A redraw (another challan ticked) keeps it too.
  await tick(page, 'IM-502').check();
  await expect(pd(page)).toHaveValue(D7);

  await pd(page).fill('');
  await expect(pd(page)).toHaveValue(await cd(page).inputValue());
  await expect(page.locator('#invPoDateHint')).toContainText('Follows the challan date');
});

test('editing an invoice keeps a P.O. date that differs from its challan date, and one that matches keeps following', async ({ page }) => {
  const s: any = state();
  const inv = (id: string, poDate: string) => ({
    id, invoiceNumber: id.slice(-5), displayNumber: 'SEP/TEST-' + id.slice(-5), date: TODAY, status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'TEST PRESS WORKS', clientGSTIN: '', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra', items: [{ partNumber: 'TEST PLATE 9', desc: 'TEST PLATE 9', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '',
    challanNo: '9', challanDate: D3, poNumber: 'PO-1', poDate, despatchDate: TODAY, transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs(),
  });
  s.invoices = [inv('INV-00001', D7), inv('INV-00002', D3)];
  s.invNextNum = 3;
  await loadAppWithState(page, s);
  for (const [id, keeps] of [['INV-00001', true], ['INV-00002', false]] as const) {
    await page.evaluate((i) => { (window as any).editInvoice(i); }, id);
    // The first edit's typed challan date is work: opening the second asks before discarding it (P108 IB4).
    if (id === 'INV-00002') await answerAsk(page, 'ok');
    await page.locator('#invOptional').evaluate((d: HTMLDetailsElement) => { d.open = true; });
    await expect(pd(page)).toHaveValue(keeps ? D7 : D3);
    await cd(page).fill(TODAY);
    await expect(pd(page)).toHaveValue(keeps ? D7 : TODAY);
  }
});
