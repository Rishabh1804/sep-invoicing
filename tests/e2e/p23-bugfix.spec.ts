import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Regressions from the bug sweep.
 *
 * The common thread in three of these: a selection that outlived the filter
 * that hid it, and an action that then reached rows nobody could see. Harmless
 * while selecting meant one tap per row; not harmless once a selection can be
 * made under one filter and spent under another.
 */

function invoice(num: number, over: Record<string, unknown> = {}) {
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'ALPHA', clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'P1', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: 130, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [], createdAt: recentTs(),
    ...over,
  };
}

function challan(id: string, clientId: number, clientName: string, part: string) {
  return {
    id, challanNo: id, challanDate: todayIso(), clientId, clientName, vehicleNo: '',
    items: [{
      id: `${id}-0`, partNumber: part, desc: part, hsn: '998873', unit: 'KG',
      qty: 100, rate: 13, amount: 1300, nosQty: null, invoiced: false, invoiceId: null,
    }],
    receivedDate: todayIso(), notes: '', createdAt: recentTs(),
  };
}

function twoClientState(): SepState {
  const s = emptyState();
  s.clients = [
    { id: 1, name: 'ALPHA', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'BETA', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
      rates: [{ ratePerKg: 5, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ] as never;
  s.incomingMaterial = [challan('IM-A', 1, 'ALPHA', 'ALPHA PART'), challan('IM-B', 2, 'BETA', 'BETA PART')];
  return s;
}

/** Tick one incoming-material line by its item id. */
async function tickIM(page: Page, itemId: string) {
  await page.locator(`[data-action="invCheckIMItem"][data-item-id="${itemId}"]`).first().click();
}

test('P23: one invoice, one customer — the rule holds in the button and the function', async ({ page }) => {
  await loadAppWithState(page, twoClientState());
  await switchTab(page, 'pageIM');

  // The IM list defaults to All Clients, so two customers' challans sit next to
  // each other and both can be ticked with no filter involved.
  await page.locator('[data-action="invToggleIM"][data-id="IM-A"]').first().click();
  await tickIM(page, 'IM-A-0');
  await page.locator('[data-action="invToggleIM"][data-id="IM-B"]').first().click();
  await tickIM(page, 'IM-B-0');

  // The selection bar already refused this, and still does.
  await expect(page.locator('[data-action="invCreateFromIM"]').first()).toBeDisabled();

  // The invariant now also lives in the function. createInvoiceFromIM assigned
  // clientId inside its collect loop — last challan wins — so it would have
  // built one invoice carrying both clients' material, billed to one of them
  // and priced off that one's rate card. Only a disabled attribute stood
  // between that and the register, and a disabled attribute is an affordance,
  // not an invariant.
  await page.evaluate('createInvoiceFromIM()');
  await expect(page.locator('.inv-toast')).toContainText('one customer');
  await expect(page.locator('.inv-toast')).toContainText('ALPHA');
  await expect(page.locator('.inv-toast')).toContainText('BETA');
  await expect(page.locator('#pageIM.inv-page-active')).toBeVisible();
});

test('P23: a single-client material selection still builds its invoice', async ({ page }) => {
  await loadAppWithState(page, twoClientState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invToggleIM"][data-id="IM-A"]').first().click();
  await tickIM(page, 'IM-A-0');
  await page.locator('[data-action="invCreateFromIM"]').first().click();

  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  // The part name is an input value, not page text.
  await expect(page.locator('[data-action="invEditLinePart"][data-idx="0"]')).toHaveValue('ALPHA PART');
  // Priced off ALPHA's card at 13/kg, not BETA's 5.
  await expect(page.locator('#pageCreate')).toContainText('1,300.00');
});

test('P23: changing the material filter drops the selection it hides', async ({ page }) => {
  await loadAppWithState(page, twoClientState());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invToggleIM"][data-id="IM-A"]').first().click();
  await tickIM(page, 'IM-A-0');

  await page.locator('#imClientFilter').selectOption('2');

  const count = await page.evaluate('Object.keys(_imSelected).length');
  expect(count).toBe(0);
});

test('P23: the register search drops its selection too', async ({ page }) => {
  const s = emptyState();
  s.invoices = [invoice(1), invoice(2, { clientName: 'ALPHA' })];
  await loadAppWithState(page, s);
  await switchTab(page, 'pageRegister');
  await page.locator('[data-action="invRegToggleSelect"]').click();
  await page.locator('[data-action="invRegSelectAll"]').click();
  expect(await page.evaluate(() => Object.keys((window as any)._regSelected).length)).toBe(2);

  // Search was the one filter that kept its selection: narrowing it left
  // earlier rows ticked but off screen, and every bulk action still reached
  // them.
  await page.locator('#regSearch').fill('00001');
  await expect(page.locator('#regList')).not.toContainText('SEP/TEST-00002');
  expect(await page.evaluate(() => Object.keys((window as any)._regSelected).length)).toBe(0);
});
