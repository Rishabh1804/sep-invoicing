import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P71 (desktop): Lines is one table grouped by status, and a line opens in the detail pane beside
// it, which takes room only while open; the reorder list is a table grouped by supplier.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('P71 desktop: Lines as a table, a line in the pane, the reorder list as a table', async ({ page }) => {
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(),
    stock: {
      items: [
        { id: 'Q', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [] },
        { id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] },
      ],
      entries: [
        { id: 'q1', itemId: 'Q', kind: 'count', qty: 40, date: iso(-5), at: 1, seq: 3 },
        { id: 'q2', itemId: 'Q', kind: 'used', qty: 10, days: 5, from: iso(-5), date: iso(-1), at: 2, seq: 2 },
        { id: 'q3', itemId: 'Q', kind: 'received', qty: 50, price: 300, supplier: 'Alpha', billNo: 'A/1', date: iso(-20), at: 1, seq: 1 },
        { id: 'n1', itemId: 'N', kind: 'count', qty: 0, date: iso(-1), at: 1, seq: 3 },
      ],
      pastes: [],
    },
  } as unknown as SepState);
  await switchTab(page, 'pageStock');
  const table = page.locator('#stockLines table.inv-table');
  await expect(table.locator('tr.inv-table-group')).toHaveText([/Out/, /OK/]);
  await expect(page.locator('#stockMasterDetail')).not.toHaveClass(/inv-pane-open/);
  await expect(page.locator('#stockDetail')).toBeHidden();

  await table.locator('button[data-action="invStockOpen"][data-id="Q"]').click();
  await expect(page.locator('#stockMasterDetail')).toHaveClass(/inv-pane-open/);
  await expect(table.locator('tr[data-id="Q"]')).toHaveAttribute('aria-current', 'true');
  // Stock is one screen (the tab map, TM4d): no view tabs to keep selected.
  await expect(page.locator('#stockContent .inv-viewtabs')).toHaveCount(0);
  await expect(page.locator('#stockDetail #stockPattern')).toContainText('Price and pattern');
  // Every panel in the pane keeps its height (the pane scrolls; it does not squeeze them).
  const h = await page.locator('#stockDetail #stockEntries').evaluate(el => el.scrollHeight - el.clientHeight);
  expect(h).toBeLessThanOrEqual(1);
  await page.locator('[data-action="invStockPaneClose"]').click();
  await expect(page.locator('#stockMasterDetail')).not.toHaveClass(/inv-pane-open/);

  await page.locator('[data-action="invStockReorder"]').click();
  await expect(page.locator('#stockReorder table.inv-table tr.inv-table-group')).toContainText(['Alpha']);
  await expect(page.locator('#stockReorder [data-stock-reorder="Q"]')).toBeVisible();
  await expect(page.locator('#pageStock .inv-btn-primary:visible')).toHaveCount(1);
});
