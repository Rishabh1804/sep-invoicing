import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * Invoice number ledger.
 *
 * Deleting an invoice used to remove the record outright. On 4 Aug inv 00666
 * was deleted for exactly the right reason — a duplicate of inv 00657 — and
 * the app lost the reason with the record, leaving a gap indistinguishable
 * from a number never issued. These specs pin the tombstone, the reason
 * requirement, and the rule that decides whether a number returns to the
 * series or stays spent.
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
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state') || '{}'));
}

/** Open the register, open one invoice's detail, and press Delete. */
async function openDelete(page: Page, invId: string) {
  await switchTab(page, 'pageRegister');
  // Scoped to the register: the Home tab renders the same data-action on its
  // recent-invoices list, hidden behind the inactive page.
  await page.locator(`#regList [data-action="invViewInvoiceDetail"][data-id="${invId}"]`).first().click();
  await page.locator('[data-action="invDeleteInvoice"]').first().click();
}

test('P11: delete refuses to proceed without a reason', async ({ page }) => {
  await loadAppWithState(page, stateWith([1, 2], 3));
  await openDelete(page, 'INV-2');

  await page.locator('[data-action="invConfirmDelete"]').click();

  await expect(page.locator('.inv-toast')).toContainText('Say why it is going');
  const s = await stored(page);
  expect(s.invoices).toHaveLength(2);
  expect(s.voidedNumbers || []).toHaveLength(0);
});

test('P11: a never-issued invoice returns its number to the series', async ({ page }) => {
  await loadAppWithState(page, stateWith([1, 2], 3));
  await openDelete(page, 'INV-2');

  await page.locator('#invDeleteReason').fill('created by mistake');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);

  const s = await stored(page);
  expect(s.invoices).toHaveLength(1);
  // Tombstone still written — the reason survives even when the number does not.
  expect(s.voidedNumbers).toHaveLength(1);
  expect(s.voidedNumbers[0].invoiceNumber).toBe('00002');
  expect(s.voidedNumbers[0].reason).toBe('created by mistake');
  expect(s.voidedNumbers[0].reserved).toBe(false);
  // Nothing holds 2, so it comes back.
  expect(s.invNextNum).toBe(2);
});

test('P11: a dispatched invoice keeps its number spent — invNextNum never walks back', async ({ page }) => {
  const state = stateWith([1, 2], 3, { 2: { invoiceState: 'dispatched', dispatchedAt: recentTs() } });
  await loadAppWithState(page, state);
  await openDelete(page, 'INV-2');

  // The warning names the real risk, not the date heuristic.
  await expect(page.locator('.inv-confirm-warn')).toContainText('customer may hold a copy');

  await page.locator('#invDeleteReason').fill('duplicate of 00001');
  await page.locator('[data-action="invConfirmDelete"]').click();
  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);

  const s = await stored(page);
  expect(s.invoices).toHaveLength(1);
  expect(s.voidedNumbers[0].reserved).toBe(true);
  expect(s.voidedNumbers[0].lastState).toBe('dispatched');
  // 00002 reached a customer. The next invoice must not reuse it.
  expect(s.invNextNum).toBe(3);
});

test('P11: the audit classifies every number in the series', async ({ page }) => {
  // 1 live, 2 cancelled, 3 voided with a reason, 4 missing entirely, 5 live.
  const state = stateWith([1, 2, 4 + 1], 6, { 2: { status: 'cancelled', cancelledAt: recentTs() } });
  state.voidedNumbers = [{
    invoiceNumber: '00003', displayNumber: 'SEP/TEST-00003', date: todayIso(),
    clientId: 1, clientName: 'TEST CLIENT KG', taxableValue: 0, grandTotal: 0,
    lastState: 'dispatched', wasCancelled: false,
    reason: 'duplicate of 00001', reserved: true, source: 'deleted', voidedAt: recentTs(),
  }];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageRegister');

  await expect(page.locator('#regNumberAudit .inv-numaudit-count')).toHaveText('1');

  await page.locator('#regNumberAudit').click();
  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toContainText('2 live');
  await expect(overlay).toContainText('1 cancelled');
  await expect(overlay).toContainText('1 voided');
  await expect(overlay).toContainText('1 unaccounted');
  // The voided number carries its reason; the missing one says so plainly.
  await expect(overlay).toContainText('duplicate of 00001');
  await expect(overlay).toContainText('Nothing recorded against this number');
});

test('P11: a historical gap can be accounted for without inventing an invoice', async ({ page }) => {
  // 00002 is absent — the shape of the five cancelled-and-filed-at-zero numbers.
  await loadAppWithState(page, stateWith([1, 3], 4));
  await switchTab(page, 'pageRegister');
  await page.locator('#regNumberAudit').click();

  await page.locator('[data-action="invAccountForNumber"][data-num="2"]').click();
  await page.locator('#invGapReason').fill('cancelled, filed in GSTR-1 at zero');
  await page.locator('[data-action="invSaveGapReason"]').click();

  const s = await stored(page);
  expect(s.invoices).toHaveLength(2);
  expect(s.voidedNumbers).toHaveLength(1);
  expect(s.voidedNumbers[0].invoiceNumber).toBe('00002');
  expect(s.voidedNumbers[0].source).toBe('reconciled');
  expect(s.voidedNumbers[0].reserved).toBe(true);

  // Audit reopens with the gap closed.
  const overlay = page.locator('.inv-overlay-scrim');
  await expect(overlay).toContainText('0 unaccounted');
  await expect(overlay).toContainText('cancelled, filed in GSTR-1 at zero');
});

test('P11: the series is read from evidence, not from 1', async ({ page }) => {
  // A book that opens at 500 has not skipped 499 numbers.
  await loadAppWithState(page, stateWith([500, 501], 502));
  await switchTab(page, 'pageRegister');

  await expect(page.locator('#regNumberAudit .inv-numaudit-count')).toHaveCount(0);
  await page.locator('#regNumberAudit').click();
  await expect(page.locator('.inv-overlay-scrim')).toContainText('0 unaccounted');
});

test('P11: a reserved void exports at zero; a recycled one does not', async ({ page }) => {
  const state = stateWith([1], 3);
  state.voidedNumbers = [
    {
      invoiceNumber: '00002', displayNumber: 'SEP/TEST-00002', date: todayIso(),
      clientId: 1, clientName: 'TEST CLIENT KG', taxableValue: 0, grandTotal: 0,
      lastState: 'dispatched', wasCancelled: false,
      reason: 'duplicate of 00001', reserved: true, source: 'deleted', voidedAt: recentTs(),
    },
    {
      invoiceNumber: '00009', displayNumber: 'SEP/TEST-00009', date: todayIso(),
      clientId: 1, clientName: 'TEST CLIENT KG', taxableValue: 0, grandTotal: 0,
      lastState: 'created', wasCancelled: false,
      reason: 'typo', reserved: false, source: 'deleted', voidedAt: recentTs(),
    },
  ];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageRegister');

  const forExport = await page.evaluate(() => (window as any).getVoidedForExport().map((v: any) => v.invoiceNumber));
  // The issued number is declared; the recycled one is not — a live invoice
  // will occupy that slot instead.
  expect(forExport).toEqual(['00002']);
});
