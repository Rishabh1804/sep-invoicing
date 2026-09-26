import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P74 (phone): History on the v2.0 components (design principles §7, §9 step 3). The filters are a toolbar
// (search, client select, labelled dates) and the kind of event is chips pressed with aria-pressed; the log is a
// flush panel of rows grouped by day, each led by its icon and ending in a dot and a word. A void is a plain row.
// The survey's bug: the filter bar stretched the chips to the height of the filters beside them and clipped them
// and the date fields off the phone's edge. No v1.0 class is drawn on any of it.

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
  test('a toolbar of filters and pressed chips that fit the phone; no v1.0 class', async ({ page }) => {
    await open(page);
    const bar = page.locator('#historyToolbar');
    await expect(bar.locator('.inv-search #historySearch')).toHaveCount(1);
    await expect(bar.locator('select.inv-select#historyClientFilter')).toHaveCount(1);
    await expect(bar.locator('.inv-field #historyDateFrom')).toHaveCount(1);
    await expect(bar.locator('.inv-field #historyDateTo')).toHaveCount(1);
    const chips = bar.locator('.inv-chip[data-action="invHistoryType"]');
    await expect(chips).toHaveText(['All', 'Invoices', 'Challans', 'Status', 'Floor', 'Audit']);
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(V1)).toHaveCount(0);

    // The filter bar fits: nothing runs off the page, and a chip is a chip's height, not the filters'.
    const vw = page.viewportSize()!.width;
    const boxes = await bar.locator('.inv-chip, input, select').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ right: r.right, h: r.height })));
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(vw);
    const chipH = (await chips.nth(0).boundingBox())!.height;
    expect(chipH).toBeLessThan(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await chips.nth(5).click();
    await expect(page.locator('#historyToolbar .inv-chip[data-type="audit"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#historyToolbar .inv-chip[data-type="all"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the log is a flush panel of rows grouped by day, each ending in a dot and a word', async ({ page }) => {
    await open(page);
    const panel = page.locator('#historyList .inv-panel.inv-panel-flush[data-card="history"]');
    await expect(panel.locator('.inv-panel-head [data-action="invHistoryExport"]')).toHaveText('Export CSV');
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
