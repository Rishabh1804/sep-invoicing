import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { closeFilter, emptyState, loadAppWithState, noSeedIM, phoneFilter, switchTab, todayIso, recentTs, toolbarMoreLabels, type SepState } from './fixtures';

// P74 (phone): History on the v2.0 components (design principles §7, §9 step 3). Since the tab map's TM6c the filters (client,
// who, the kind of event, the dates) are behind Filter in one toolbar row with the search and More, said under it as tokens: as a
// bar and seven chips they filled half the phone's first screen. The log is a flush panel of rows grouped by day, each led by its
// icon and ending in a dot and a word. A void is a plain row. No v1.0 class is drawn on any of it.

function state(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = [{
    id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/T-00001', date: todayIso(), status: 'active', invoiceState: 'dispatched',
    clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', items: [], taxableValue: 1000, grandTotal: 1180,
    createdAt: recentTs(3600000), dispatchedAt: recentTs(1800000),
  }];
  s.voidedNumbers = [{ invoiceNumber: '00002', displayNumber: 'SEP/T-00002', reason: 'Typed twice', reserved: false,
    clientId: 1, clientName: 'TEST CLIENT KG', grandTotal: 590, voidedAt: recentTs(600000) }];
  s.extraExceptions = [{ iso: '2026-05-04', scope: 'area', key: 'vat-a1', kind: 'over', label: 'VAT A1', expected: 8, booked: 16,
    reason: 'Second crew', at: new Date(2026, 6, 1, 9, 30).getTime() }];
  return s;
}

const V1 = '#pageHistory [class*="inv-history"], #pageHistory [class*="inv-stats-"], #pageHistory [class*="inv-activity"], ' +
  '#pageHistory .inv-chip-active, #pageHistory .inv-empty-state, #pageHistory .inv-im-toolbar, #pageHistory .inv-form-input, ' +
  '#pageHistory .inv-form-select, #pageHistory .inv-flex-between';

async function open(page: Page) {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageHistory');
}

test.describe('P74: History', () => {
  test('one toolbar row: the search, Filter and More; the filters in Filter’s dialog, said as tokens; no v1.0 class', async ({ page }) => {
    await open(page);
    const bar = page.locator('#historyToolbar [data-history-toolbar]');
    await expect(bar.locator('.inv-search #historySearch')).toHaveCount(1);
    await expect(bar.locator('[data-action="invTbFilter"]')).toBeVisible();
    await expect(bar.locator('select, input[type="date"], .inv-chip')).toHaveCount(0);
    await phoneFilter(page);
    const dlg = page.locator('[data-tb-filter-dialog]');
    await expect(dlg.locator('select.inv-select#historyClientFilter')).toHaveCount(1);
    await expect(dlg.locator('.inv-field #historyDateFrom')).toHaveCount(1);
    await expect(dlg.locator('.inv-field #historyDateTo')).toHaveCount(1);
    await expect(dlg.locator('select#historyType option')).toHaveText(['Every kind', 'Invoices', 'Challans', 'Status', 'Floor', 'Audit', 'Changes']);
    await dlg.locator('select#historyType').selectOption('audit');
    await closeFilter(page);
    await expect(page.locator('#historyToolbar .inv-tokens [data-clear="kind"]')).toContainText('Audit');
    await expect(bar.locator('[data-action="invTbFilter"] .inv-badge')).toHaveText('1');
    await expect(page.locator(V1)).toHaveCount(0);
    // Nothing runs off the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // A token clears its own filter.
    await page.locator('#historyToolbar .inv-tokens [data-clear="kind"]').click();
    await expect(page.locator('#historyToolbar .inv-tokens')).toHaveCount(0);
  });

  test('the log is a flush panel of rows grouped by day, each ending in a dot and a word', async ({ page }) => {
    await open(page);
    const panel = page.locator('#historyList .inv-panel.inv-panel-flush[data-card="history"]');
    // Export is the toolbar's More (the tab map, TM6c), not the panel's head.
    expect(await toolbarMoreLabels(page)).toEqual(['Export CSV']);
    // Created, dispatched, the void, the exception, and the fixture's seed-blocker challan.
    await expect(panel.locator('.inv-panel-count')).toHaveText('5');
    await expect(panel.locator('.inv-row-group').first()).toContainText(String(new Date().getFullYear()));
    const created = panel.locator('button.inv-row[data-ev="invoice"][data-action="invHistoryJumpInvoice"]');
    await expect(created).toContainText('created for TEST CLIENT KG');
    await expect(created.locator('.inv-row-lead svg')).toHaveCount(1);
    await expect(created.locator('.inv-dot-neutral')).toHaveText('Invoice');
    await expect(panel.locator('[data-ev="state"] .inv-dot-ok')).toHaveText('Status');
    // A void has nothing to open: a plain row, in the danger tone and its word.
    const voided = panel.locator('[data-ev="void"]');
    expect(await voided.evaluate((e) => e.tagName)).toBe('DIV');
    await expect(voided).not.toHaveAttribute('data-action', /.*/);
    await expect(voided.locator('.inv-dot-danger')).toHaveText('Deleted');
    // The exception ledger is on the recorded clock and says so.
    await expect(panel.locator('[data-ev="except"] .inv-row-meta')).toHaveText('01 Jul 2026, 09:30 · recorded');
    // Opening a row still jumps to the register.
    await created.click();
    await expect(page.locator('#pageRegister.inv-page-active')).toHaveCount(1);
  });

  test('an empty log says why, as an empty panel', async ({ page }) => {
    await open(page);
    await page.locator('#historySearch').fill('no such thing');
    await expect(page.locator('#historyList .inv-panel .inv-empty')).toHaveText('No activity matches these filters');
  });
});
