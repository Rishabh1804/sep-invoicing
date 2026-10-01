import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P53 desktop: the labelled sidebar (§4.2; DIRECTION_B: grouped by workspace) and density following the layout (§3.5).

test.describe('P53 desktop: sidebar and density', () => {
  test('the sidebar is grouped by workspace, and Items and Pay are views inside their page, whose entry stays on', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await expect(page.locator('#invSidebar .inv-side-item[data-ws] .inv-side-label')).toHaveText(['Today', 'Office', 'Floor', 'Money', 'Insights']);
    expect(await page.evaluate(() => getComputedStyle(document.body).marginLeft)).toBe('216px');
    await expect(page.locator('#invSidebar [data-sub]')).toHaveCount(0);
    await page.locator('.inv-side-item[data-tab="pageClients"]').click();
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('[data-action="invSwitchSubView"][data-view="items"]').first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.inv-side-item[data-tab="pageClients"]')).toHaveClass(/inv-side-item-on/);
    await page.locator('.inv-side-item[data-tab="pageStaff"]').click();
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await expect(page.locator('.inv-side-item[data-tab="pageStaff"]')).toHaveAttribute('aria-current', 'page');
    // Any view of the page carries its entry's mark.
    await page.locator('[data-action="invAttView"][data-view="week"]').click();
    await expect(page.locator('.inv-side-item[data-tab="pageStaff"]')).toHaveClass(/inv-side-item-on/);
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
