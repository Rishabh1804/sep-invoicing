import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P75 (desktop): Settings' two panes on the v2.0 components (§6.19): the groups down the left as inv-side-items,
// the open one aria-current; an unsaved group reads as a dot and a word beside its name.

test.describe('P75 desktop: Settings', () => {
  test('the group list is side items, the open one current, an unsaved one marked in words', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await page.evaluate(() => localStorage.removeItem('sep_inv_settings_ui'));
    await openSettingsAt(page, 'extra');
    const items = page.locator('.inv-dialog-nav button.inv-side-item');
    await expect(items).toHaveCount(7);   // 1 Oct 2026: Access (Devices; Users with the gate)
    const labour = items.filter({ hasText: 'Labour' });
    await expect(labour).toHaveAttribute('aria-current', 'true');
    await expect(labour).toHaveClass(/inv-side-item-on/);
    await expect(page.locator('.inv-dialog-nav [aria-current]')).toHaveCount(1);
    await page.locator('#setExtraRate').fill('50');
    await expect(labour.locator('.inv-dot-warning')).toHaveText('Unsaved');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="extra"]').click();
    await expect(labour.locator('.inv-dot-warning')).toHaveCount(0);
    // The pane scrolls on its own; the dialog keeps its height.
    const card = await page.locator('#settingsScrim .inv-dialog').boundingBox();
    const vh = page.viewportSize()!.height;
    expect(card!.height).toBeLessThanOrEqual(vh);
  });
});
