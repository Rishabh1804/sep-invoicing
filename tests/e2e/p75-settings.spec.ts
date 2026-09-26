import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P75 (phone): Settings on the v2.0 components (design principles §6.19, §7, §9 step 3). Each section is a
// panel that folds (inv-panel-fold) whose head says what it is set to; its fields are inv-field / inv-input,
// its tick boxes inv-field-check, a derivation is worked in a callout, and an unsaved edit is a dot and a word.
// The survey's phone bug: the whole sheet scrolled, so the title and its close button went off the top the
// moment a section was opened. The head stays put now and only the groups scroll.

const V1 = '#settingsScrim [class*="inv-set-"], #settingsScrim [class*="inv-form-"], #settingsScrim .inv-checkbox-label, ' +
  '#settingsScrim [class*="inv-storage"], #settingsScrim .inv-text-muted, #settingsScrim [class*="inv-api-key"], ' +
  '#settingsScrim .inv-link-btn, #settingsScrim .inv-diag-report, #settingsScrim .inv-sync-status, #settingsScrim .inv-check-row';

async function load(page: import('@playwright/test').Page) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  await page.evaluate(() => localStorage.removeItem('sep_inv_settings_ui'));
}

test.describe('P75: Settings', () => {
  test('sections are folding panels of fields; no v1.0 class in any of them', async ({ page }) => {
    await load(page);
    await page.locator('[data-action="invOpenSettings"]').first().click();
    const secs = page.locator('#settingsScrim details.inv-panel.inv-panel-fold[data-sec]');
    expect(await secs.count()).toBe(19);
    // Open every section, so each module's fields (To-do, GitHub sync, appearance, backup) are drawn.
    for (const d of await secs.all()) {
      if (!(await d.evaluate(x => (x as HTMLDetailsElement).open))) await d.locator(':scope > summary').click();
    }
    await expect(page.locator(V1)).toHaveCount(0);
    await expect(page.locator('details[data-sec="company"] .inv-field #setCompName.inv-input')).toHaveCount(1);
    await expect(page.locator('#setNextNum')).toHaveClass(/inv-input-num/);
    await expect(page.locator('details[data-sec="todo"] label.inv-field-check input.inv-check').first()).toBeVisible();
    await expect(page.locator('label.inv-field-check #setGhAuto')).toHaveCount(1);
    // A key is typed once and shown by an icon button beside it.
    await expect(page.locator('[data-action="invToggleMetalsKey"].inv-btn-icon')).toHaveAttribute('aria-label', 'Show key');
    await page.locator('#setMetalsKey').fill('abc');
    await page.locator('[data-action="invToggleMetalsKey"]').click();
    await expect(page.locator('#setMetalsKey')).toHaveAttribute('type', 'text');
    // An empty derivation callout is not drawn.
    await expect(page.locator('#zincUpliftOut')).toBeHidden();
    // The backup section: the storage figures as key/value pairs, the build identified.
    await expect(page.locator('details[data-sec="data"] .inv-kv .inv-build-id')).toHaveClass(/inv-id/);
  });

  test('an unsaved edit is a dot and a word on its section, gone once saved', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'rateCheck');
    const d = page.locator('details[data-sec="rateCheck"]');
    await expect(d.locator('[data-unsaved]')).toHaveCount(0);
    await page.locator('#setRcPct').fill('12');
    await expect(d.locator(':scope > summary .inv-dot.inv-dot-warning[data-unsaved]')).toHaveText('Unsaved');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="rateCheck"]').click();
    await expect(d.locator('[data-unsaved]')).toHaveCount(0);
    await expect(page.locator('[data-sum="rateCheck"]')).toHaveText('12% · ₹100 · ±3%');
  });

  test('the head stays in view while the groups scroll', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'data');
    await openSettingsAt(page, 'sync');
    await page.locator('details[data-sec="data"]').scrollIntoViewIfNeeded();
    const close = page.locator('[data-action="invCloseSettings"]');
    await expect(close).toBeInViewport();
    const card = await page.locator('#settingsScrim .inv-dialog').boundingBox();
    const head = await page.locator('#settingsScrim .inv-dialog-head').boundingBox();
    expect(head!.y).toBeGreaterThanOrEqual(card!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
