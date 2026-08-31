import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/*
 * The desktop sidebar offset must not reach the paper.
 *
 * `body.inv-desktop { margin-left: 64px }` shifts the interface clear of the
 * sidenav. The print block reset it, but at identical specificity and 1,300
 * lines earlier in the stylesheet — so source order won and every document
 * printed from the desktop layout came out displaced 64px right: 29mm of left
 * margin against 12mm of right, and 240px with the sidebar expanded.
 *
 * This runs in the desktop project because the bug only exists where the
 * `inv-desktop` class is applied, which is the layout the owner prints from.
 */

function stateWithInvoice(): SepState {
  const s = emptyState();
  const items = [{ partNumber: '2082 3240 4200', desc: 'CLAMP 165X83 (NT)', hsn: '998873', unit: 'KG', qty: 10, rate: 5.4, amount: 54, nosQty: null }];
  s.invoices = [{
    id: 'INV-1', invoiceNumber: '00812', displayNumber: 'SEP/2026-27/00812',
    date: todayIso(), status: 'active', invoiceState: 'created',
    dispatchedAt: null, deliveredAt: null, filedAt: null,
    clientId: 1, clientName: 'TEST CLIENT KG', clientGSTIN: '',
    clientAddress: { add1: 'A-4', add2: 'ADITYAPUR', add3: '', state: 'JHARKHAND', stateCode: '20' },
    gstType: 'intra', items, taxableValue: 54,
    cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: 54, amountInWords: '', challanNo: '804', challanDate: todayIso(),
    poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
    linkedIMIds: [], createdAt: recentTs(),
  }];
  s.invNextNum = 2;
  return s;
}

test('P31 desktop: the sidebar offset is off the printed page', async ({ page }) => {
  await loadAppWithState(page, stateWithInvoice());
  await switchTab(page, 'pageRegister');
  // The desktop register is master-detail with its own table: the row action
  // is `invSelectRegRow`, not the overlay's `invViewInvoiceDetail`, and
  // Preview lands in the detail panel rather than in a scrim.
  await page.locator('#regMaster [data-action="invSelectRegRow"][data-id="INV-1"]').first().click();
  await page.locator('#regDetail [data-action="invPreviewInvoice"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();

  // The layout under test: without this class there is no offset to reset.
  await expect(page.locator('body.inv-desktop')).toHaveCount(1);

  await page.emulateMedia({ media: 'print' });
  // Read it immediately. The transition that used to animate this value is
  // disabled in print, so there is nothing to wait out — waiting would hide
  // exactly the regression this pins.
  expect(await page.evaluate(() => getComputedStyle(document.body).marginLeft)).toBe('0px');
});

test('P31 desktop: nothing animates in print', async ({ page }) => {
  await loadAppWithState(page, stateWithInvoice());
  await switchTab(page, 'pageRegister');
  await page.locator('#regMaster [data-action="invSelectRegRow"][data-id="INV-1"]').first().click();
  await page.locator('#regDetail [data-action="invPreviewInvoice"]').first().click();
  await page.locator('.inv-print-view-active').waitFor();

  // This assertion belongs in the desktop project, not the mobile one: the
  // 300ms margin-left transition is declared on `body.inv-desktop`, so on a
  // phone viewport there is nothing to animate and the check cannot fail.
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => getComputedStyle(document.body).transitionDuration)).toBe('0s');
});
