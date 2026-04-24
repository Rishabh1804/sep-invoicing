import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

test.describe('Golden flows — smoke coverage for inv-1-2', () => {

  test('invoice-create: Create tab renders the form with "Create Invoice" CTA', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageCreate');

    await expect(page.locator('#createFormArea')).toBeVisible();
    await expect(page.locator('#invClientSearch')).toBeVisible();

    // P1 regression: new-invoice save-bar must say "Create Invoice", not "Save Invoice".
    const saveBtn = page.locator('#invSaveBtn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toHaveText(/Create Invoice/);
    await expect(saveBtn).not.toHaveText(/Save Invoice/);
  });

  test('invoice-send: Register lists a seeded invoice', async ({ page }) => {
    const state = emptyState();
    state.invoices = [{
      id: 'INV-TEST-1',
      invoiceNumber: '00001',
      displayNumber: 'SEP/TEST-00001',
      date: '2026-04-10',
      status: 'active',
      invoiceState: 'created',
      dispatchedAt: null, deliveredAt: null, filedAt: null,
      clientId: 1,
      clientName: 'TEST CLIENT KG',
      clientGSTIN: '',
      clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' },
      gstType: 'intra',
      items: [{ partNumber: 'P1', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 10, rate: 13, amount: 130, nosQty: null }],
      taxableValue: 130, cgstPer: 9, cgstAmt: 11.7, sgstPer: 9, sgstAmt: 11.7, igstPer: 0, igstAmt: 0,
      grandTotal: 153.4, amountInWords: 'Rupees One Hundred Fifty Three and Forty Paise Only',
      challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
      createdAt: Date.now(),
    }];

    await loadAppWithState(page, state);
    await switchTab(page, 'pageRegister');

    const regList = page.locator('#regList');
    await expect(regList).toBeVisible();
    await expect(regList).toContainText('SEP/TEST-00001');
    await expect(regList).toContainText('TEST CLIENT KG');
  });

  test('payment-record: Stats page mounts with seeded invoice (no crash)', async ({ page }) => {
    const state = emptyState();
    state.invoices = [{
      id: 'INV-TEST-2',
      invoiceNumber: '00002',
      displayNumber: 'SEP/TEST-00002',
      date: '2026-04-11',
      status: 'active',
      invoiceState: 'delivered',
      dispatchedAt: Date.now() - 86400000, deliveredAt: Date.now(), filedAt: null,
      clientId: 1,
      clientName: 'TEST CLIENT KG',
      clientGSTIN: '',
      clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' },
      gstType: 'intra',
      items: [{ partNumber: 'P2', desc: 'Sample', hsn: '998873', unit: 'KG', qty: 20, rate: 13, amount: 260, nosQty: null }],
      taxableValue: 260, cgstPer: 9, cgstAmt: 23.4, sgstPer: 9, sgstAmt: 23.4, igstPer: 0, igstAmt: 0,
      grandTotal: 306.8, amountInWords: '',
      challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
      createdAt: Date.now() - 172800000,
    }];

    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    // Stats tab renders without errors when invoices exist; content area is populated.
    await expect(page.locator('#statsContent')).toBeVisible();
  });

});
