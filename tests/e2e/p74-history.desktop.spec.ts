import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P74 (desktop): History's log is a table grouped by day (tr.inv-table-group): time, event, kind as a dot and
// a word, amount right-aligned. Every event opens in the pane beside the log (UX overhaul 2, step 7, P147) through a
// real button, so it opens from the keyboard; a void opens too and says its invoice is gone, with no way to an invoice.
// A floor row's time cell says it is a floor day rather than inventing a time.

test('P74 desktop: the log is a table grouped by day', async ({ page }) => {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/T-00001', date: todayIso(), status: 'active',
    invoiceState: 'created', clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', items: [], taxableValue: 1000,
    grandTotal: 1180, createdAt: recentTs(3600000) }];
  s.voidedNumbers = [{ invoiceNumber: '00002', displayNumber: 'SEP/T-00002', reason: 'Typed twice', reserved: false,
    clientId: 1, clientName: 'TEST CLIENT KG', grandTotal: 590, voidedAt: recentTs(600000) }];
  s.staff = [{ id: 1, name: 'Test Monthly', comp: 'monthly', rate: 500, area: 'vat-a1', active: true, floor: true }];
  s.attendance = { '2026-05-04': { marks: { 1: { st: 'P', area: 'vat-a1' } }, extra: [] } };
  await loadAppWithState(page, s as SepState);
  await switchTab(page, 'pageHistory');

  const table = page.locator('#historyList table.inv-table.inv-table-history');
  await expect(table.locator('thead th')).toHaveText(['Time', 'Event', 'Kind', 'Amount']);
  // Today's group, the floor day's, and the fixture's undated seed-blocker challan.
  await expect(table.locator('tr.inv-table-group')).toHaveCount(3);
  await expect(table.locator('tr.inv-table-group').filter({ hasText: '04 May 2026 · 1' })).toHaveCount(1);
  const created = table.locator('tr[data-ev="invoice"]');
  await expect(created.locator('td.inv-num')).toHaveText('₹1,180.00');
  await expect(created.locator('.inv-dot-neutral')).toHaveText('Invoice');
  const voided = table.locator('tr[data-ev="void"]');
  await voided.locator('button[data-action="invHistoryOpen"]').click();
  await expect(page.locator('#historyPane [data-history-pane="void"]')).toBeVisible();
  await expect(page.locator('#historyPane [data-action="invHistoryJumpInvoice"]')).toHaveCount(0);
  const shift = table.locator('tr[data-ev="shift"]');
  await expect(shift.locator('td').first()).toHaveText('floor day');
  await expect(shift).not.toContainText('12:00');

  await created.locator('button.inv-btn-link[data-action="invHistoryOpen"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#historyPane [data-history-pane="invoice"]')).toBeVisible();
  await page.locator('#historyPane [data-action="invHistoryJumpInvoice"]').click();
  await expect(page.locator('#pageRegister.inv-page-active')).toHaveCount(1);
});
