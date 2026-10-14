import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState, openPulse, toolbarMore } from './fixtures';

// P71 (phone): Stock on the v2.0 components (design principles §7, §9 step 3), one screen since the tab map (TM4d): Paste
// message the one primary, its card's tiles that filter, lines as rows grouped by status with a dot and a word;
// a line's page as tiles, rows and panels; the paste check as rows with the text as sent; Enter by
// hand's mode an inv-seg; the More sheet an inv-sheet of rows. No v1.0 inv-stk- or inv-more- class
// is drawn on any of them. The quick actions still open their jobs.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function state(): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    stock: {
      items: [
        { id: 'Q', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [] },
        { id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] },
        { id: 'H', name: 'HCL', key: 'HCL', unit: 'L', basis: 'draw', aliases: [] },
        { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] },
      ],
      entries: [
        { id: 'q1', itemId: 'Q', kind: 'count', qty: 40, date: iso(-5), at: 1, seq: 3 },
        { id: 'q2', itemId: 'Q', kind: 'used', qty: 10, days: 5, from: iso(-5), date: iso(-1), at: 2, seq: 2 },
        { id: 'q3', itemId: 'Q', kind: 'received', qty: 50, price: 300, supplier: 'Alpha', billNo: 'A/1', date: iso(-20), at: 1, seq: 1, raw: '2) Q558 add 50' },
        { id: 'n1', itemId: 'N', kind: 'count', qty: 0, date: iso(-1), at: 1, seq: 3 },
        { id: 'h1', itemId: 'H', kind: 'count', qty: 400, date: iso(-5), at: 1, seq: 3 },
        { id: 'h2', itemId: 'H', kind: 'used', qty: 20, days: 5, from: iso(-5), date: iso(-1), at: 2, seq: 2 },
      ],
      pastes: [],
    },
  } as unknown as SepState;
}

// No v1.0 class, and at most one primary (a line's page has none until its bill form opens).
const noV1 = async (page: Page, primaries = 1) => {
  await expect(page.locator('#stockContent [class*="inv-stk-"]')).toHaveCount(0);
  await expect(page.locator('#pageStock .inv-btn-primary:visible')).toHaveCount(primaries);
};

test.describe('P71: Stock', () => {
  test('the lines: the card\'s tiles filter, rows grouped by status carry a dot and a word; no v1.0 class', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await expect(page.locator('#stockContent .inv-viewtabs')).toHaveCount(0);
    await noV1(page);
    await expect(page.locator('#stockVerdict .inv-hero-eyebrow')).toContainText('4 lines');
    // The status tiles are the card's factors (TM4d): shut on the phone, opened to filter.
    await page.locator('#stockVerdict > summary').click();
    const rows = page.locator('#stockLines .inv-row[data-action="invStockOpen"]');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: 'Nitric acid' }).locator('.inv-dot-danger')).toHaveText('Out');
    await expect(rows.filter({ hasText: 'Zinc' }).locator('.inv-dot-info')).toHaveText('Shelf empty');

    const out = page.locator('#stockTiles button.inv-tile[data-v="out"]');
    await expect(out).toHaveClass(/inv-tile-danger/);
    await out.click();
    await expect(page.locator('#stockTiles button.inv-tile[data-v="out"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Nitric acid');
    // Pressed again, every line is back.
    await page.locator('#stockTiles button.inv-tile[data-v="out"]').click();
    await expect(rows).toHaveCount(4);
    // "No rate" takes the bath line with the unrated ones.
    await page.locator('#stockTiles button.inv-tile[data-v="none"]').click();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Zinc');
  });

  test('a line: tiles, Price and pattern rows, the line\'s settings, entries with a fold of the text as sent', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await page.locator('#stockLines [data-action="invStockOpen"]').filter({ hasText: 'Q558' }).click();
    await expect(page.locator('#stockContent .inv-pagehead-title')).toHaveText('Q558');
    await expect(page.locator('#stockLevel')).toContainText('30');
    await expect(page.locator('#stockSummary .inv-tile')).toHaveCount(4);
    await expect(page.locator('#stockPattern .inv-row').first()).toContainText('₹300.00/kg');
    await expect(page.locator('#stockEdit .inv-seg-btn[data-v="draw"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#stockEdit .inv-seg-btn[data-v="charge"]').click();
    await expect(page.locator('#stockEdit .inv-seg-btn[data-v="charge"]')).toHaveAttribute('aria-pressed', 'true');
    const entry = page.locator('#stockEntries [data-entry="q3"]');
    await expect(entry.locator('.inv-quote')).toBeHidden();
    await entry.locator('summary.inv-summary').click();
    await expect(entry.locator('.inv-quote')).toHaveText('2) Q558 add 50');
    await noV1(page, 0);
    // The bill form opens in place, and is the view's one primary.
    await page.locator('#stockPattern [data-action="invStockBillOpen"]').click();
    await expect(page.locator('#stockBillForm .inv-input#stockBillSupplier')).toBeFocused();
    await noV1(page);
    await page.locator('[data-action="invStockBack"]').click();
    await expect(page.locator('#stockLines')).toBeVisible();
  });

  test('the paste check: rows with the text as sent, a badge, chips for the figure, Save in the action bar', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockPaste"]').click();
    await expect(page.locator('#stockPasteText.inv-textarea')).toBeVisible();
    await noV1(page);
    await page.locator('#stockPasteText').fill('Chemical stock\n\n1) Q558 40-5=30 KG\n\n2) HCL 380 LTR');
    await page.locator('[data-action="invStockRead"]').click();
    const red = page.locator('#stockReview .inv-row[data-tone="red"]');
    await expect(red).toHaveCount(1);
    await expect(red.locator('.inv-quote')).toHaveText('Q558 40-5=30 KG');
    await expect(red.locator('.inv-badge-danger')).toHaveText('Needs you');
    await expect(red.locator('.inv-callout-danger').filter({ hasText: 'The message says 30' })).toHaveCount(1);
    await expect(page.locator('#stockReviewTiles.inv-tiles-3 .inv-tile')).toHaveCount(3);
    await red.locator('.inv-chip[data-v="working"]').click();
    await expect(page.locator('#stockReview .inv-chip[data-v="working"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#stockContent .inv-actionbar [data-action="invStockSavePaste"]')).toBeEnabled();
    await noV1(page);
  });

  test('Enter by hand: the mode is a segmented control; Home\'s Stock entry opens it (Paste message is covered by P41)', async ({ page }) => {
    await loadAppWithState(page, state());
    await openPulse(page);
    await page.locator('[data-action="invHomeQuick"][data-go="stock"]').click();
    await expect(page.locator('.inv-seg-btn[data-mode="count"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    await expect(page.locator('.inv-seg-btn[data-mode="received"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#stockManSupplier.inv-input')).toBeVisible();
    await expect(page.locator('#stockContent .inv-actionbar [data-action="invStockSaveManual"]')).toBeVisible();
    await noV1(page);
  });

  test('the reorder list: rows by supplier, the total in the action bar', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await toolbarMore(page, 'Reorder list');
    await expect(page.locator('#stockReorder .inv-row-group').first()).toBeVisible();
    await expect(page.locator('#stockReorder [data-stock-reorder="Q"]')).toHaveClass(/inv-input-num/);
    await expect(page.locator('#stockContent .inv-actionbar #stockReorderTotal')).toBeVisible();
    await noV1(page);
  });

  test("Stock is a tab in Floor's row; the page on screen is the tab pressed, and its line out counts on Floor", async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    const row = page.locator('#wsTabs.inv-viewtabs[role="tablist"]');
    await expect(row.locator('.inv-viewtab[role="tab"]')).toHaveCount(await page.locator('#pageFloor').count() ? 5 : 4);
    await expect(row.locator('.inv-viewtab[data-tab="pageStock"]')).toHaveAttribute('aria-selected', 'true');
    await expect(row.locator('.inv-viewtab[aria-selected="true"]')).toHaveCount(1);
    await expect(page.locator('.inv-navbar-item[data-ws="floor"] .inv-navbar-count')).toHaveText('1');
    await expect(page.locator('[class*="inv-more-"], .inv-sheet, #moreSheet')).toHaveCount(0);
  });
});
