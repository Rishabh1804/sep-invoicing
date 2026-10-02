import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, type SepState } from './fixtures';

// P50 (desktop): Settings as two panes — the groups down the left, one group
// at a time on the right, the group remembered on the device.

test.describe('P50: Settings on the desktop', () => {
  test('two panes: one group at a time, chosen from the list, and remembered', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await page.evaluate(() => localStorage.removeItem('sep_inv_settings_ui'));
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('.inv-dialog-nav')).toBeVisible();
    await expect(page.locator('.inv-dialog-nav .inv-side-item')).toHaveText(['Business', 'Checks & alerts', 'Costing', 'Labour', 'Connections', 'Access', 'Data & device']);
    await expect(page.locator('section[data-group="business"]')).toBeVisible();
    await expect(page.locator('section[data-group="labour"]')).toBeHidden();

    // The list and the pane sit side by side.
    const nav = await page.locator('.inv-dialog-nav').boundingBox();
    const pane = await page.locator('.inv-dialog-main').boundingBox();
    expect(nav!.x + nav!.width).toBeLessThanOrEqual(pane!.x);

    await page.locator('[data-action="invSettingsGroup"][data-group="labour"]').click();
    await expect(page.locator('section[data-group="labour"]')).toBeVisible();
    await expect(page.locator('section[data-group="business"]')).toBeHidden();

    // An unsaved edit marks its group in the list, and saving clears it.
    await page.locator('details[data-sec="extra"] > summary').click();
    await page.locator('#setExtraRate').fill('47.5');
    const btn = page.locator('[data-action="invSettingsGroup"][data-group="labour"]');
    await expect(btn).toHaveAttribute('data-dirty', '');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="extra"]').click();
    await expect(btn).not.toHaveAttribute('data-dirty', '');
    expect((await readStoredState(page)).labour.extraRate).toBe(47.5);

    await page.locator('[data-action="invCloseSettings"]').click();
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('section[data-group="labour"]')).toBeVisible();
    await expect(page.locator('details[data-sec="extra"]')).toHaveAttribute('open', '');
  });

  test('a section in another group is reached through the list', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await openSettingsAt(page, 'data');
    await expect(page.locator('[data-action="invExportData"]')).toBeVisible();
    await expect(page.locator('section[data-group="business"]')).toBeHidden();
  });
});
