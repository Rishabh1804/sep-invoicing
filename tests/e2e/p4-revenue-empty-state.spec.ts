import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// P4 assertion: "Revenue by Client" empty-state is upgraded from a terse muted-text
// ("No client data") to an actionable empty-state (copy + "Create an invoice" CTA).

test.describe('P4: Revenue by Client empty-state', () => {

  test('empty state renders new copy + CTA when no invoices exist', async ({ page }) => {
    // emptyState() seeds a client but zero invoices — the exact trigger for the empty state.
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageStats');

    const content = page.locator('#statsContent');
    await expect(content).toBeVisible();

    // Positive: new copy is present.
    await expect(content).toContainText('No revenue in this period');

    // Positive: CTA button is present and wired to the existing Create action.
    const cta = content.locator('button[data-action="invCreateNew"]', { hasText: 'Create an invoice' });
    await expect(cta).toBeVisible();

    // Regression: legacy terse copy must not appear anywhere in the stats content.
    await expect(content).not.toContainText('No client data');
  });

  test('CTA switches to the Create tab (wiring intact)', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageStats');

    const cta = page.locator('#statsContent button[data-action="invCreateNew"]');
    await expect(cta).toBeVisible();
    await cta.click();

    // After click, the Create page becomes active and renders the form area.
    await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
    await expect(page.locator('#createFormArea')).toBeVisible();
  });

  test('empty-state copy is absent when invoices exist (positive regression)', async ({ page }) => {
    const state = emptyState();
    state.invoices = [{
      id: 'INV-P4-REG',
      invoiceNumber: '00010',
      displayNumber: 'SEP/TEST-00010',
      date: '2026-04-15',
      status: 'active',
      invoiceState: 'created',
      dispatchedAt: null, deliveredAt: null, filedAt: null,
      clientId: 1,
      clientName: 'TEST CLIENT KG',
      clientGSTIN: '',
      clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' },
      gstType: 'intra',
      items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 5, rate: 10, amount: 50, nosQty: null }],
      taxableValue: 50, cgstPer: 9, cgstAmt: 4.5, sgstPer: 9, sgstAmt: 4.5, igstPer: 0, igstAmt: 0,
      grandTotal: 59, amountInWords: '',
      challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
      createdAt: Date.now(),
    }];

    await loadAppWithState(page, state);
    await switchTab(page, 'pageStats');

    const content = page.locator('#statsContent');
    await expect(content).toBeVisible();
    // With revenue present, the empty-state copy should not be rendered.
    await expect(content).not.toContainText('No revenue in this period');
    await expect(content.locator('button[data-action="invCreateNew"]')).toHaveCount(0);
  });

});
