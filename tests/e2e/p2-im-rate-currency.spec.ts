import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// P2 assertion: IM list line-item rate must render via formatCurrency
// (₹-prefixed, not the bare toFixed(2) that formatNum produced pre-P2).

test('P2: IM line-item rate renders with ₹ prefix (formatCurrency)', async ({ page }) => {
  const state = emptyState();
  state.incomingMaterial = [{
    id: 'IM-P2-1',
    challanNo: 'P2-CH-001',
    challanDate: '2026-04-01',
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    vehicleNo: '',
    items: [{
      id: 'IMI-P2-1-0',
      partNumber: 'P2 PART',
      desc: 'P2 Test Part',
      hsn: '998873',
      unit: 'KG',
      qty: 10,
      rate: 13,
      amount: 130,
      invoiced: false,
      invoiceId: null,
    }],
    receivedDate: '2026-04-01',
    notes: '',
    createdAt: Date.now(),
  }];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageIM');

  // Expand the challan so line items render.
  const header = page.locator('[data-action="invToggleIM"][data-id="IM-P2-1"]');
  await expect(header).toBeVisible();
  await header.click();

  const detail = page.locator('.inv-im-item-detail').first();
  await expect(detail).toBeVisible();

  // Post-P2 expected format: "10 KG @ ₹13.00/KG"
  await expect(detail).toHaveText(/₹13\.00\/KG/);
  // Regression guard: the bare pre-P2 format ("@ 13.00/KG" without ₹) must not appear.
  await expect(detail).not.toHaveText(/@ 13\.00\/KG/);
});
