import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, openPulse, withHomeWidgets, openWidget, openHome } from './fixtures';

// P3 assertion: Home "Recent Invoices" empty-state upgraded from a bare muted-text
// ("No invoices yet") to a more useful empty-state block with an icon + CTA that
// routes first-run users directly to the Create form.
//
// Test shape follows Cipher's recommended triad from PR #4:
//   1. positive match (new content present) + regression guard (legacy shape absent)
//   2. CTA wiring intact
//   3. positive regression (empty-state absent when data exists)
//
// The widget is off in every preset since the tab map (TM2c: the recent invoices are Needs you's), so each test puts it on the
// board as the gallery does; on a new device the way to the first invoice is Add, the second test's check.

test.describe('P3: Home "Recent Invoices" empty-state', () => {
  test.beforeEach(async ({ page }) => { await withHomeWidgets(page, ['recent']); });

  test('empty state renders icon + copy + CTA when no invoices exist', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await openWidget(page, 'recent');
    // App already lands on Home; renderHome() is called on init. Confirm explicit return.
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();

    // The card's blank state since UI pass 3 (§6.32): its icon and its words; the way to the first invoice is the card's Act (U2R
    // §24e: a blank state's action is the Act's tinted button).
    const recent = page.locator('#homeBoard [data-w="recent"]');
    const blank = recent.locator('.inv-blank');
    await expect(blank).toBeVisible();

    // Positive: icon is present, the blank state's own.
    await expect(blank.locator('.inv-blank-icon svg')).toBeVisible();
    // Positive: copy present.
    await expect(blank).toContainText('No invoices yet');
    // Positive: CTA present with the correct action + text.
    const cta = recent.locator('.inv-widget-act button[data-action="invCreateNew"]', { hasText: 'Create your first invoice' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveClass(/inv-btn-tint/);

    // Regression guard: the pre-P3 shape was ONLY a muted text line with no SVG icon.
    // If someone ever reverts the icon, this test fails.
    await expect(blank.locator('svg')).toHaveCount(1);
  });

  test('on a new device (the Owner preset) the recent invoices are Needs you’s, and Add’s Invoice opens the form', async ({ page }) => {
    // No layout of the device's own: the board is the Owner preset (UI pass 3, U2), which carries neither the recent invoices
    // (Needs you lists them) nor the quick actions; Add, the bar's centre door, holds Invoice among its by-hand forms.
    await page.addInitScript(() => { try { localStorage.removeItem('sep_inv_layout'); localStorage.removeItem('sep_inv_home'); } catch { /* none */ } });
    await loadAppWithState(page, emptyState());
    await openHome(page);
    await expect(page.locator('#homeBoard [data-w="recent"]')).toHaveCount(0);
    await page.locator('[data-action="invAddOpen"]:visible').first().click();
    await page.locator('[data-action="invAddHand"][data-go="invoice"]').click();
    await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  });

  test('CTA click routes to the Create tab (wiring intact)', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await openWidget(page, 'recent');

    const cta = page.locator('#homeBoard [data-w="recent"] .inv-widget-act button[data-action="invCreateNew"]');
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
    await openWidget(page, 'recent');
    await expect(page.locator('#pageHome.inv-page-active')).toBeVisible();

    const recent = page.locator('#recentInvoices');
    await expect(recent).toBeVisible();

    // With a real invoice seeded, the list renders the invoice row — NOT the empty-state block.
    await expect(recent).toContainText('SEP/TEST-00020');
    await expect(recent.locator('svg.inv-empty-icon')).toHaveCount(0);
    await expect(recent.locator('button[data-action="invCreateNew"]')).toHaveCount(0);
    await expect(recent).not.toContainText('Create your first invoice');
    // The card holds no blank state, and its Act offers a new invoice, not the first one (U2R).
    const card = page.locator('#homeBoard [data-w="recent"]');
    await expect(card.locator('.inv-blank')).toHaveCount(0);
    await expect(card).not.toContainText('Create your first invoice');
  });

});
