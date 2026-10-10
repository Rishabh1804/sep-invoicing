import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, noSeedIM, SepState } from './fixtures';

/* P108 on the desktop: an edit returns to the Register with the invoice open in the pane, and the select-all
   box in the table's head follows the selection. */

const g = (page: Page, expr: string) => page.evaluate(x => (0, eval)(x), expr);

function inv(num: number) {
  const n = String(num).padStart(5, '0');
  return {
    id: 'INV-' + num, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra', items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
    taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4, amountInWords: '',
    challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs(), updatedAt: recentTs(),
  };
}

function book(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = [inv(1), inv(2)];
  s.invNextNum = 3;
  return s;
}

test('IB2 (desktop): Update invoice returns to the Register with the invoice in the pane', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageRegister');
  await page.locator('#regMaster [data-action="invSelectRegRow"][data-id="INV-2"]').first().click();
  await page.locator('#regDetail [data-action="invEditInvoice"]').click();
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await page.locator('#invSaveBtn').click();
  await expect(page.locator('#pageRegister.inv-page-active')).toBeVisible();
  await expect(page.locator('#regDetail')).toContainText('SEP/TEST-00002');
  expect(await g(page, '_regActiveInvId')).toBe('INV-2');
});

test('IB6 (desktop): ticking a row off after select-all offers Select all again', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageRegister');
  // Select-all is the table head's tick box (the tab map, TM5c: it was a button in the toolbar's row), and follows the rows.
  const all = page.locator('#pageRegister thead [data-action="invRegSelectAll"]');
  await all.click();
  await expect(all).toBeChecked();
  await expect(all).toHaveAttribute('aria-label', 'Clear the selection');
  await page.locator('#regMaster [data-action="invRegToggleInv"]').first().click();
  await expect(all).not.toBeChecked();
  await expect(all).toHaveAttribute('aria-label', 'Select all 2');
});
