import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P53 desktop: the rail (§4.2; DIRECTION_B, and since 8 Oct 2026 the workspaces alone, their views the tab row under the top
// bar) and density following the layout (§3.5).

test.describe('P53 desktop: rail and density', () => {
  test('the rail is the workspaces; Parts and Pay are views inside their page, whose tab stays pressed', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await expect(page.locator('#invSidebar .inv-side-item[data-ws]')).toHaveText([/^Today/, /^Office/, /^Floor/, /^Money/]);
    expect(await page.evaluate(() => getComputedStyle(document.body).marginLeft)).toBe('88px');
    await expect(page.locator('#invSidebar [data-sub], #invSidebar [data-tab]')).toHaveCount(0);
    await page.locator('#invSidebar [data-ws="office"]').click();
    await page.locator('#wsTabs [data-tab="pageClients"][data-v="clients"]').click();
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('[data-action="invSwitchSubView"][data-view="items"]').first()).toHaveAttribute('aria-selected', 'true');
    // Parts is in Clients' group (the tab map, 9 Oct 2026): Clients stays pressed, Sales does not.
    await expect(page.locator('#wsTabs [data-tab="pageClients"][data-v="clients"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#wsTabs [data-tab="pageClients"][data-v="prospects"]')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#invSidebar [data-ws="office"]')).toHaveClass(/inv-side-item-on/);
    await page.locator('#invSidebar [data-ws="floor"]').click();
    await page.locator('#wsTabs [data-tab="pageStaff"]').click();
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await expect(page.locator('#wsTabs [data-tab="pageStaff"]')).toHaveAttribute('aria-selected', 'true');
    // Any view of the page keeps its tab pressed and its workspace's door on.
    await page.locator('[data-action="invAttView"][data-view="week"]').click();
    await expect(page.locator('#wsTabs [data-tab="pageStaff"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#invSidebar [data-ws="floor"]')).toHaveAttribute('aria-current', 'true');
  });

  test('density is compact on the desktop until the device says otherwise', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-density', 'compact');
    await openSettingsAt(page, 'appearance');
    await page.locator('[data-action="invAppearance"][data-k="density"][data-v="comfortable"]').click();
    await expect(html).toHaveAttribute('data-density', 'comfortable');
    await expect(page.locator('[data-sum="appearance"]')).toHaveText('Teal · follows the phone · comfortable');
  });
});
