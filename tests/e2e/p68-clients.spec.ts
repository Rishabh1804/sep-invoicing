import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, recentTs, switchTab, todayIso } from './fixtures';
import { clientsState } from './clients-fixture';

// P68 (phone): Clients / Items / Performance on the v2.0 components (design principles §9 step 3).
// One Add per view, and no floating one (the survey's doubled Add buttons); view tabs; the items
// sort <select> speaks through change only; a tick box selects its row; Performance's measure is
// a segmented control.

async function openView(page: Page, view: string) {
  await switchTab(page, 'pageClients');
  await page.locator(`[data-action="invSwitchSubView"][data-view="${view}"]`).click();
  await expect(page.locator(`.inv-viewtab[data-view="${view}"]`)).toHaveAttribute('aria-selected', 'true');
}

test.describe('P68: Clients, Items and Performance', () => {
  test('each list view has one Add, in its toolbar, and no floating button', async ({ page }) => {
    await loadAppWithState(page, clientsState());
    await openView(page, 'clients');
    await expect(page.locator('.inv-viewtabs[role="tablist"] .inv-viewtab[role="tab"]')).toHaveCount(3);
    await expect(page.locator('#pageClients [data-action="invAddClient"]')).toHaveCount(1);
    await expect(page.locator('#pageClients .inv-btn-primary')).toHaveCount(1);
    await expect(page.locator('#clientsItemsFab, #pageClients .inv-fab')).toHaveCount(0);
    // Rows open the edit sheet; an inactive client is muted and says so.
    await expect(page.locator('#clientList .inv-row')).toHaveCount(2);
    await expect(page.locator('#clientList .inv-row-muted')).toContainText('Inactive');
    await page.locator('#clientList [data-action="invEditClient"][data-id="1"]').click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Edit client');
    await expect(page.locator('#ceditRates .inv-row')).toContainText('Current');

    await page.locator('.inv-overlay-close').click();
    await openView(page, 'items');
    await expect(page.locator('#pageClients [data-action="invAddItem"]')).toHaveCount(1);
    await expect(page.locator('#pageClients .inv-btn-primary')).toHaveCount(1);
  });

  test('the sort select sorts on change and carries no action; a filter chip is pressed', async ({ page }) => {
    await loadAppWithState(page, clientsState());
    await openView(page, 'items');
    const sort = page.locator('#itemsSort');
    await expect(sort).not.toHaveAttribute('data-action', /.*/);
    const first = page.locator('#itemsList [data-item-row] .inv-row-title').first();
    await expect(first).toHaveText('AAA PART');
    await sort.selectOption('rate');
    await expect(first).toHaveText('BBB PART');

    const chip = page.locator('[data-action="invFilterNoWeight"]');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(page.locator('[data-action="invFilterNoWeight"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#itemsList [data-item-row]')).toHaveCount(2);
  });

  test('a tick box selects its row, once, and the selection bar counts it', async ({ page }) => {
    await loadAppWithState(page, clientsState());
    await openView(page, 'items');
    // Tapping the label's full touch target, not only the box, ticks it exactly once.
    await page.locator('[data-item-row="2"] .inv-row-tick').click();
    await expect(page.locator('[data-item-row="2"]')).toHaveClass(/inv-row-selected/);
    await expect(page.locator('#itemsSelBar .inv-selbar')).toContainText('1 selected');
    await page.locator('[data-item-row="2"] .inv-row-tick').click();
    await expect(page.locator('[data-item-row="2"]')).not.toHaveClass(/inv-row-selected/);
    await expect(page.locator('#itemsSelBar .inv-selbar')).toHaveCount(0);
  });

  test('Performance reads its measure from a segmented control, and the latest month as tiles', async ({ page }) => {
    const st = clientsState();
    st.invoices = [{
      id: 'I1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: todayIso(), status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'ALPHA WORKS', gstType: 'intra',
      items: [{ partNumber: 'AAA PART', desc: 'first', hsn: '998873', unit: 'KG', qty: 100, rate: 13, amount: 1300 }],
      taxableValue: 1300, grandTotal: 1534, createdAt: recentTs(),
    }];
    await loadAppWithState(page, st);
    await openView(page, 'performance');
    await expect(page.locator('#cpClientSelect')).not.toHaveAttribute('data-action', /.*/);
    const seg = page.locator('.inv-seg [data-action="invPerfSeries"]');
    await expect(seg).toHaveCount(3);
    await expect(page.locator('[data-series="revenue"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-series="tonnage"]').click();
    await expect(page.locator('[data-series="tonnage"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-series="revenue"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-cp-trend] .inv-tile')).toHaveCount(4);
    await expect(page.locator('[data-cp-trend] .inv-tile', { hasText: 'Tonnage' })).toContainText('100 kg');
    await expect(page.locator('[data-cp-group="new"]')).toContainText('AAA PART');
  });
});
