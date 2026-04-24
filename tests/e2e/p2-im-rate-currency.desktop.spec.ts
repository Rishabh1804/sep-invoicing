import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// Desktop companion to p2-im-rate-currency.spec.ts.
// The IM view has TWO rendering code paths: mobile card (split/im.js:149) and
// desktop master-detail (split/im.js:349). Both sites render `.inv-im-item-detail`
// with the "@ rate/unit" token and both need the formatCurrency fix.
// This spec forces the desktop code path.

test('P2 desktop: IM master-detail rate renders with ₹ prefix', async ({ page }) => {
  const state = emptyState();
  state.incomingMaterial = [{
    id: 'IM-P2-DESK',
    challanNo: 'P2-DESK-001',
    challanDate: '2026-04-01',
    clientId: 1,
    clientName: 'TEST CLIENT KG',
    vehicleNo: '',
    items: [{
      id: 'IMI-P2-DESK-0',
      partNumber: 'P2 DESK PART',
      desc: 'P2 Desktop Test Part',
      hsn: '998873',
      unit: 'KG',
      qty: 15,
      rate: 13,
      amount: 195,
      invoiced: false,
      invoiceId: null,
    }],
    receivedDate: '2026-04-01',
    notes: '',
    createdAt: Date.now(),
  }];

  await loadAppWithState(page, state);
  await switchTab(page, 'pageIM');

  // Desktop renders a master (table) + detail pane. Click the row to populate detail.
  const row = page.locator('tr[data-id="IM-P2-DESK"]');
  await expect(row).toBeVisible();
  // Desktop sidebar overlaps the row visually; use dispatchEvent to bypass
  // actionability checks (app binds via delegated `data-action` click handlers).
  await row.locator('[data-action="invSelectIMRow"]').first().dispatchEvent('click');

  const detail = page.locator('#imDetail .inv-im-item-detail').first();
  await expect(detail).toBeVisible();
  await expect(detail).toHaveText(/₹13\.00\/KG/);
  await expect(detail).not.toHaveText(/@ 13\.00\/KG/);
});
