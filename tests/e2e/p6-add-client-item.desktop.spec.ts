import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// P6 desktop assertion: the FAB was suppressed in the desktop master-detail layout,
// which once left Items Master with no reachable Add control at all and Client
// Master with none in either layout. Both sub-views expose one visible, labelled
// Add button in the toolbar, and the floating one is gone (design system §9).

test.describe('P6 desktop: add entry points survive the master-detail layout', () => {

  test('Clients sub-view exposes a visible Add Client button', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();

    const add = page.locator('.inv-toolbar [data-action="invAddClient"]');
    await expect(add).toBeVisible();
    await expect(add).toHaveText('Add client');

    // One Add in the view: the toolbar button is the entry point, and there is no floating one.
    await expect(page.locator('#pageClients [data-action="invAddClient"]')).toHaveCount(1);
    await expect(page.locator('#clientsItemsFab')).toHaveCount(0);

    await add.click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add client');
  });

  test('a newly added client lands selected in the detail panel', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();

    await page.locator('.inv-toolbar [data-action="invAddClient"]').click();
    await page.locator('#ceditName').fill('DESKTOP NEW CLIENT');
    await page.locator('[data-action="invSaveClient"][data-mode="add"]').click();

    // Detail panel shows the new client...
    await expect(page.locator('#clientsDetail')).toContainText('DESKTOP NEW CLIENT');
    // ...and the table row is marked open, which only happens if the master is
    // re-rendered *after* _clientsActiveId is set.
    await expect(page.locator('#clientList tr[aria-current="true"]')).toContainText('DESKTOP NEW CLIENT');
  });

  test('Items sub-view exposes a visible Add Item button', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();

    const add = page.locator('.inv-toolbar [data-action="invAddItem"]');
    await expect(add).toBeVisible();
    await expect(add).toHaveText('Add item');
    await expect(page.locator('#pageClients [data-action="invAddItem"]')).toHaveCount(1);

    await add.click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add item');
  });

});
