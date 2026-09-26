import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { clientsState } from './clients-fixture';

// P68 desktop: Clients and Items are tables with the Register's on-demand pane (§6.14).
// The pane takes room only while a row is open, closes from its head, gives focus back to
// the row it came from, and shuts when a filter hides its row.

test('a client opens in the pane, with one primary, and closes back to its row', async ({ page }) => {
  await loadAppWithState(page, clientsState());
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').click();
  const wrap = page.locator('#clientsMasterDetail');
  await expect(wrap).not.toHaveClass(/inv-pane-open/);
  await expect(page.locator('#clientList table.inv-table')).toBeVisible();
  await expect(page.locator('.inv-drag-handle')).toHaveCount(0);

  await page.locator('#clientList button[data-action="invSelectClientRow"][data-id="1"]').click();
  await expect(wrap).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#clientList tr[aria-current="true"]')).toContainText('ALPHA WORKS');
  await expect(page.locator('#clientsDetail')).toContainText('Rate history');
  await expect(page.locator('#clientsDetail .inv-btn-primary')).toHaveText('Edit');

  await page.locator('[data-action="invClientsClosePane"]').click();
  await expect(wrap).not.toHaveClass(/inv-pane-open/);
  await expect(page.locator('#clientList button[data-action="invSelectClientRow"][data-id="1"]')).toBeFocused();

  // A search that hides the open client shuts its pane.
  await page.locator('#clientList button[data-action="invSelectClientRow"][data-id="1"]').click();
  await page.locator('#clientSearch').fill('beta');
  await expect(wrap).not.toHaveClass(/inv-pane-open/);
});

test('an item opens in the pane; a tick box in the table selects without opening it', async ({ page }) => {
  await loadAppWithState(page, clientsState());
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').click();
  const wrap = page.locator('#clientsMasterDetail');
  await page.locator('#itemsList [data-action="invToggleItemSelect"][data-id="3"]').check();
  await expect(page.locator('#itemsList tr[data-item-row="3"]')).toHaveClass(/inv-row-selected/);
  await expect(wrap).not.toHaveClass(/inv-pane-open/);

  await page.locator('#itemsList button[data-action="invSelectItemRow"][data-id="2"]').click();
  await expect(wrap).toHaveClass(/inv-pane-open/);
  await expect(page.locator('#clientsDetail')).toContainText('BBB PART');
  // Switching to Clients leaves the item behind: the pane belongs to the view it was opened in.
  await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').click();
  await expect(page.locator('#clientsMasterDetail')).not.toHaveClass(/inv-pane-open/);
});
