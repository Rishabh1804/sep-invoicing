import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab } from './fixtures';

// P6 desktop assertion: the FAB is suppressed in the desktop master-detail layout,
// which previously left Items Master with no reachable Add control at all and
// Client Master with none in either layout. Both sub-views must now expose a
// visible, labelled Add button in the toolbar.

test.describe('P6 desktop: add entry points survive the master-detail layout', () => {

  test('Clients sub-view exposes a visible Add Client button', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="clients"]').first().click();

    const add = page.locator('.inv-toolbar-add[data-action="invAddClient"]');
    await expect(add).toBeVisible();
    await expect(add).toHaveText('Add Client');

    // FAB stays out of the way on desktop — the toolbar button is the entry point.
    await expect(page.locator('#clientsItemsFab')).toBeHidden();

    await add.click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add Client');
  });

  test('Items sub-view exposes a visible Add Item button', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();

    const add = page.locator('.inv-toolbar-add[data-action="invAddItem"]');
    await expect(add).toBeVisible();
    await expect(add).toHaveText('Add Item');

    await add.click();
    await expect(page.locator('.inv-overlay-title')).toHaveText('Add Item');
  });

});
