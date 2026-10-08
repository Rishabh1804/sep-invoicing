import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, type SepState } from './fixtures';

// P181: a part field's blur closes its own list, never another's. Leaving a part field closes its suggestion list a moment
// later (a tap on one of its options lands first). That deferred close hid every list on the page, so a client search
// opened inside the moment, on another screen, was hidden under the cursor and could not be picked: CI hit it on P141, where
// a challan saved and Create's client search typed into fit inside the 200 ms on a busy runner. Made-up names.

const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
const CLIENT = 'ALPHA PLATING WORKS';

function book(): SepState {
  const s: any = emptyState();
  s.clients = [{ id: 1, name: CLIENT, billingMode: 'weight', gstType: 'intra', gstin: '20ABCDE1234F1Z5', state: 'JHARKHAND', stateCode: '20',
    add1: 'Plot 1', add2: 'Adityapur', add3: '', address: '', isActive: true, notes: '',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2025-04-01' }], itemRates: [] }];
  s.items = [{ id: 1, partNumber: 'P1', desc: 'Bracket', unit: 'KG', rate: 13, hsn: '998873' }];
  s.incomingMaterial = [{ id: 'IM-1', challanNo: '301', challanDate: todayIso(), clientId: 1, clientName: CLIENT, vehicleNo: '',
    items: [{ id: 'IM-1-0', partNumber: 'P1', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 50, rate: 13, amount: 650, invoiced: false, invoiceId: null }],
    receivedDate: todayIso(), notes: '', createdAt: Date.now() - 7200000 }];
  return s as SepState;
}

test('a client search opened just after a part field is left stays open, and its client can be picked', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('ALPHA');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  const part = page.locator('[data-action="invEditChallanPart"][data-idx="0"]');
  await part.fill('P');
  // Leave the part field, then, inside the moment its list waits before closing, open Create and type into its client search.
  await g(page, `(function () {
    var qty = document.querySelector('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]');
    qty.focus();
    switchTab('pageCreate');
    var cs = document.getElementById('invClientSearch');
    cs.focus(); cs.value = 'alpha'; cs.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(400);
  await expect(page.locator('#invClientResults')).toBeVisible();
  await page.locator('[data-action="invSelectClient"]').first().click();
  await expect(page.locator('#pageCreate [data-chosen-client]')).toContainText(CLIENT);
});

test('a part field left closes its own list a moment later; a tap on one of its options lands first', async ({ page }) => {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('ALPHA');
  await page.locator('[data-action="invSelectChallanClient"]').first().click();
  const part = page.locator('[data-action="invEditChallanPart"][data-idx="0"]');
  const list = page.locator('#imPartAC0');
  await part.fill('P');
  await expect(list).toBeVisible();
  // Left for another field: the list closes.
  await page.locator('[data-action="invUpdateChallanLine"][data-field="qty"][data-idx="0"]').focus();
  await expect(list).toBeHidden();
  // Opened again and an option tapped: the pick lands before the list closes.
  await part.fill('P1');
  await expect(list).toBeVisible();
  await list.locator('[data-action="invSelectChallanPart"]').first().click();
  await expect(part).toHaveValue('P1');
});
