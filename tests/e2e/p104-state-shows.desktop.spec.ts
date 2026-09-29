import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs } from './fixtures';

// P104 desktop: the Register's pane and table show a print and a mark at once.
const items = [{ partNumber: 'CLAMP 100X83 (NT)', desc: 'CLAMP 100X83 (NT)', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }];
const book = () => {
  const s: any = emptyState();
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '20ABCDE1234F1Z5', clientAddress: { add1: 'A', add2: 'B', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra', items, taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0, grandTotal: 153.4,
    amountInWords: '', challanNo: '834', challanDate: todayIso(), poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '', linkedIMIds: [],
    createdAt: recentTs() }];
  s.invNextNum = 2;
  return s;
};

test('Print and Mark dispatched show in the pane and the table at once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, book());
  await page.evaluate(() => { window.print = function() {}; });
  await switchTab(page, 'pageRegister');
  const row = page.locator('#regMaster tr').filter({ hasText: 'SEP/TEST-00001' }).first();
  const step = page.locator('#regDetail [aria-current="step"]');
  await page.locator('#regMaster [data-action="invSelectRegRow"][data-id="INV-1"]').first().click();
  await expect(step).toContainText('Created');
  await page.locator('#regDetail [data-action="invPreviewInvoice"]').click();
  await page.locator('[data-action="invPrint"]').click();
  await page.locator('[data-action="invClosePrint"]').click();
  await expect(step).toContainText('Printed');
  await expect(row).toContainText('Printed');
  await page.locator('#regDetail [data-action="invAdvanceState"][data-state="dispatched"]').click();
  await expect(step).toContainText('Dispatched');
  await expect(row).toContainText('Dispatched');
});
