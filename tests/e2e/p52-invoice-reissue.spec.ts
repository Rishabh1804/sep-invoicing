import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, openSettingsAt, SepState } from './fixtures';

/*
 * P52: correcting an invoice under the number it already carries.
 *
 * The owner's practice before this (25 Sep 2026): delete the invoice, set
 * Settings' next number back to it, create the corrected one, set it forward
 * again. Ten live numbers were made that way, two of them twice. Three things
 * were wrong with doing it by hand: Next was left one past the reissued number
 * (a duplicate waiting for the next invoice), every deleted copy exported at
 * zero beside the live invoice (00862 three times in one GSTR-1 file), and
 * nothing stopped a number from a FILED return being issued again.
 */

function invoice(num: number, over: Record<string, unknown> = {}) {
  return {
    id: `INV-${num}`,
    invoiceNumber: String(num).padStart(5, '0'),
    displayNumber: `SEP/TEST-${String(num).padStart(5, '0')}`,
    date: todayIso(),
    status: 'active',
    invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    clientGSTIN: '',
    clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '20' },
    gstType: 'intra',
    items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0,
    grandTotal: 153.4, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(),
    ...over,
  };
}

function stateWith(nums: number[], nextNum: number, over: Record<number, Record<string, unknown>> = {}): SepState {
  const state = emptyState();
  state.invoices = nums.map((n) => invoice(n, over[n] || {}));
  state.invNextNum = nextNum;
  return state;
}

async function stored(page: Page) {
  return page.evaluate(async () => JSON.parse((await (window as any).readPersistedStateRaw()) || '{}'));
}

async function openDelete(page: Page, invId: string) {
  await switchTab(page, 'pageRegister');
  await page.locator(`#regList [data-action="invViewInvoiceDetail"][data-id="${invId}"]`).first().click();
  await page.locator('[data-action="invDeleteInvoice"]').first().click();
}

test('P52: delete and reissue keeps the number, the series and one clean export row', async ({ page }) => {
  await loadAppWithState(page, stateWith([1, 2, 3], 4, { 2: { invoiceState: 'dispatched', dispatchedAt: recentTs() } }));
  await openDelete(page, 'INV-2');
  await page.locator('#invDeleteReason').fill('Rate mismatch');
  await page.locator('[data-action="invConfirmReissue"]').click();

  await expect(page.locator('.inv-reissue-note')).toContainText('SEP/TEST-00002');
  const save = page.locator('[data-action="invSaveInvoice"]');
  await expect(save).toHaveText('Reissue 00002');
  await save.click();
  await expect(page.locator('.inv-toast')).toContainText('SEP/TEST-00002 saved');

  const s = await stored(page);
  const two = s.invoices.filter((i: any) => i.invoiceNumber === '00002');
  expect(two).toHaveLength(1);
  expect(two[0].id).not.toBe('INV-2');
  expect(two[0].items[0]).toMatchObject({ partNumber: 'P1', qty: 10, rate: 13 });
  expect(s.invNextNum).toBe(4);
  expect(s.voidedNumbers).toHaveLength(1);
  expect(s.voidedNumbers[0]).toMatchObject({ invoiceNumber: '00002', reason: 'Rate mismatch', reserved: true });
  // The old copy is history; the export lists the number once, as the live invoice.
  expect(await page.evaluate(() => (window as any).getVoidedForExport().length)).toBe(0);
  const audit = await page.evaluate(() => (window as any).analyseInvoiceNumbers().counts);
  expect(audit.reissued).toBe(1);
});

test('P52: a filed invoice cannot be reissued', async ({ page }) => {
  await loadAppWithState(page, stateWith([1, 2], 3, { 2: { invoiceState: 'filed', filedAt: recentTs() } }));
  await openDelete(page, 'INV-2');
  await expect(page.locator('[data-action="invConfirmDelete"]')).toBeVisible();
  await expect(page.locator('[data-action="invConfirmReissue"]')).toHaveCount(0);
});

test('P52: a number deleted twice exports once, and not at all once reissued', async ({ page }) => {
  const st = stateWith([1, 2, 3, 4], 6);
  const v = (n: string, at: number) => ({ invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
    taxableValue: 130, grandTotal: 153.4, lastState: 'dispatched', wasCancelled: false, reason: 'test', reserved: true, source: 'deleted', voidedAt: at });
  (st as any).voidedNumbers = [v('00002', 1), v('00002', 2), v('00005', 3), v('00005', 4)];
  await loadAppWithState(page, st);
  const rows = await page.evaluate(() => (window as any).getVoidedForExport().map((x: any) => [x.invoiceNumber, x.voidedAt]));
  expect(rows).toEqual([['00005', 4]]);
});

test('P52: Settings may point the series at a free, unfiled number, and the series then carries on', async ({ page }) => {
  const st = stateWith([1, 2, 4, 5], 6);
  const v = (n: string, last: string) => ({ invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
    taxableValue: 130, grandTotal: 153.4, lastState: last, wasCancelled: false, reason: 'test', reserved: true, source: 'deleted', voidedAt: 1 });
  (st as any).voidedNumbers = [v('00003', 'dispatched')];
  await loadAppWithState(page, st);
  await openSettingsAt(page, 'invoice');
  const save = page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]');

  await page.locator('#setNextNum').fill('4');
  await save.click();
  await expect(page.locator('.inv-toast')).toContainText('SEP/TEST-00004 is held by a live invoice');

  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await page.locator('#setNextNum').fill('3');
  await save.click();
  expect(asked).toContain('SEP/TEST-00003');
  expect(asked).toContain('carries on from SEP/TEST-00006');
  await expect(page.locator('.inv-toast')).toContainText('Invoice series saved');
  await page.locator('[data-action="invCloseSettings"]').click();

  // The next invoice takes 00003, and Next goes back to 6, never to 4.
  // invoiceForm is a script-level `let`, reachable by a global eval, not on window.
  await page.evaluate(() => (0, eval)(`invoiceForm.clientId = 1;
    invoiceForm.items = [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }];
    renderCreateForm();`));
  await switchTab(page, 'pageCreate');
  await page.locator('[data-action="invSaveInvoice"]').click();
  const s = await stored(page);
  expect(s.invoices.map((i: any) => i.invoiceNumber).sort()).toEqual(['00001', '00002', '00003', '00004', '00005']);
  expect(s.invNextNum).toBe(6);
});

test('P52: a number from a filed return is never issued again', async ({ page }) => {
  const st = stateWith([1, 2, 4], 5);
  (st as any).voidedNumbers = [{ invoiceNumber: '00003', displayNumber: 'SEP/TEST-00003', date: todayIso(), clientId: 1, clientName: 'X',
    taxableValue: 0, grandTotal: 0, lastState: 'filed', wasCancelled: false, reason: 'test', reserved: true, source: 'deleted', voidedAt: 1 }];
  await loadAppWithState(page, st);
  await openSettingsAt(page, 'invoice');
  await page.locator('#setNextNum').fill('3');
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]').click();
  await expect(page.locator('.inv-toast')).toContainText('was in a filed return');
  expect((await stored(page)).invNextNum).toBe(5);
});
