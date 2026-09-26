import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, todayIso, recentTs, type SepState } from './fixtures';

// P73 (desktop): Stats' panels two across. A half panel fills the gap beside another (inv-panels-dense), so
// Output tax and Invoice states share a row; a wide card spans both columns.

test('P73 desktop: half panels sit side by side, wide ones span the row', async ({ page }) => {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = [{ id: '1', invoiceNumber: '00001', displayNumber: 'SEP/T-00001', date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 100, rate: 10, amount: 1000 }],
    taxableValue: 1000, cgstAmt: 90, sgstAmt: 90, igstAmt: 0, grandTotal: 1180, createdAt: recentTs() }];
  await loadAppWithState(page, s as SepState);
  await openStatsTab(page, 'billing');
  const [gst, states, unbilled] = await Promise.all(['gst', 'states', 'unbilled'].map((c) => page.locator(`[data-card="${c}"]`).boundingBox()));
  expect(Math.abs(gst!.y - states!.y)).toBeLessThan(2);
  expect(states!.x).toBeGreaterThan(gst!.x + gst!.width - 1);
  expect(unbilled!.width).toBeGreaterThan(gst!.width * 1.9);
});
