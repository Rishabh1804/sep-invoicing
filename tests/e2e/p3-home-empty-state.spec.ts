import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// P3 assertion: Home "Recent Invoices" empty-state upgraded from a bare muted-text
// ("No invoices yet") to a more useful empty-state block with an icon + CTA that
// routes first-run users directly to the Create form.
//
// Test shape follows Cipher's recommended triad from PR #4:
//   1. positive match (new content present) + regression guard (legacy shape absent)
//   2. CTA wiring intact
//   3. positive regression (empty-state absent when data exists)

test.describe('P3: Home "Recent Invoices" empty-state', () => {

  test('empty state renders icon + copy + CTA when no invoices exist', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    // App already lands on Home; renderHome() is called on init. Confirm explicit return.
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();

    const recent = page.locator('#recentInvoices');
    await expect(recent).toBeVisible();

    // Positive: icon is present and sized via the new .inv-empty-state-icon class.
    await expect(recent.locator('svg.inv-empty-state-icon')).toBeVisible();
    // Positive: copy present.
    await expect(recent).toContainText('No invoices yet');
    // Positive: CTA present with the correct action + text.
    const cta = recent.locator('button[data-action="invCreateNew"]', { hasText: 'Create your first invoice' });
    await expect(cta).toBeVisible();

    // Regression guard: the pre-P3 shape was ONLY a muted text line with no SVG icon.
    // If someone ever reverts the icon, this test fails.
    await expect(recent.locator('svg')).toHaveCount(1);
  });

  test('CTA click routes to the Create tab (wiring intact)', async ({ page }) => {
    await loadAppWithState(page, emptyState());

    const cta = page.locator('#recentInvoices button[data-action="invCreateNew"]');
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
    await expect(page.locator('#createFormArea')).toBeVisible();
  });

  test('empty-state block is absent when invoices exist (positive regression)', async ({ page }) => {
    const state = emptyState();
    state.invoices = [{
      id: 'INV-P3-REG',
      invoiceNumber: '00020',
      displayNumber: 'SEP/TEST-00020',
      date: '2026-04-20',
      status: 'active',
      invoiceState: 'created',
      dispatchedAt: null, deliveredAt: null, filedAt: null,
      clientId: 1,
      clientName: 'TEST CLIENT KG',
      clientGSTIN: '',
      clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' },
      gstType: 'intra',
      items: [{ partNumber: 'P3', desc: 'P3', hsn: '998873', unit: 'KG', qty: 8, rate: 12, amount: 96, nosQty: null }],
      taxableValue: 96, cgstPer: 9, cgstAmt: 8.64, sgstPer: 9, sgstAmt: 8.64, igstPer: 0, igstAmt: 0,
      grandTotal: 113.28, amountInWords: '',
      challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '', transport: '', remarks: '',
      createdAt: Date.now(),
    }];

    await loadAppWithState(page, state);
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();

    const recent = page.locator('#recentInvoices');
    await expect(recent).toBeVisible();

    // With a real invoice seeded, the list renders the invoice row — NOT the empty-state block.
    await expect(recent).toContainText('SEP/TEST-00020');
    await expect(recent.locator('svg.inv-empty-state-icon')).toHaveCount(0);
    await expect(recent.locator('button[data-action="invCreateNew"]')).toHaveCount(0);
    await expect(recent).not.toContainText('Create your first invoice');
  });

});
