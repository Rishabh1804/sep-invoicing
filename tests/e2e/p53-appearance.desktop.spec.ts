import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P53 desktop: the labelled sidebar (§4.2) and density following the layout (§3.5).

test.describe('P53 desktop: sidebar and density', () => {
  test('the sidebar is grouped, and Items and Pay open their parent on that sub-view', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await expect(page.locator('.inv-side-group')).toHaveText(['Daily', 'Book', 'Floor', 'Review']);
    expect(await page.evaluate(() => getComputedStyle(document.body).marginLeft)).toBe('216px');
    await page.locator('.inv-side-item[data-sub="items"]').click();
    await expect(page.locator('#topbarTitle')).toHaveText('Clients');
    await expect(page.locator('.inv-side-item[data-sub="items"]')).toHaveClass(/inv-side-item-on/);
    await expect(page.locator('.inv-side-item[data-tab="pageClients"]:not([data-sub])')).not.toHaveClass(/inv-side-item-on/);
    await expect(page.locator('[data-action="invSwitchSubView"][data-view="items"]').first()).toHaveClass(/inv-subview-active/);
    await page.locator('.inv-side-item[data-sub="pay"]').click();
    await expect(page.locator('.inv-side-item[data-sub="pay"]')).toHaveAttribute('aria-current', 'page');
    // Back to a sub-view with no entry of its own: the parent carries the mark.
    await page.locator('[data-action="invAttView"][data-view="week"]').click();
    await expect(page.locator('.inv-side-item[data-tab="pageStaff"]:not([data-sub])')).toHaveClass(/inv-side-item-on/);
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
