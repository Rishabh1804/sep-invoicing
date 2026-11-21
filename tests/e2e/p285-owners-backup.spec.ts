import { test, expect, Page } from '@playwright/test';
import { loadAppWithState, openSettingsAt, answerAsk } from './fixtures';
import { guardBook, withUsers, unlock, lockNow, PINS, g } from './p140-guard.fixture';

/*
 * P285. The export is the owner's alone.
 *
 * Export JSON wrote the whole book for any role: only workers' personal details were left out of another role's file,
 * so a role that is shown no rupee on screen took every invoice, rate and wage away in it. The owner ruled the export
 * his alone (21 Nov 2026). Another role's device is backed up by the GitHub sync.
 */

const val = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

// A download, or none within a moment of the call.
async function downloadOf(page: Page, run: () => Promise<unknown>) {
  let got: any = null;
  const on = (d: any) => { got = d; };
  page.on('download', on);
  await run();
  await page.waitForTimeout(400);
  page.off('download', on);
  return got;
}

test.describe('P285: the export is the owner\'s alone', () => {
  test('another role: no file, the refusal said, and no button in Settings', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    const dl = await downloadOf(page, () => g(page, 'exportData()'));
    expect(dl).toBeNull();
    expect(await answerAsk(page)).toContain('can’t export the book');
    // Settings' own section, as it is drawn for this role (the phone hides Settings' door from it).
    const html = String(await val(page, 'SETTINGS_SECS.data.body()'));
    expect(html).toContain('invImportData');
    expect(html).not.toContain('invExportData');
    await expect(page.locator('[data-action="invExportData"]')).toHaveCount(0);
  });

  test('the owner: the button, and the whole book in the file', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await openSettingsAt(page, 'data');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('details[data-sec="data"] [data-action="invExportData"]').click()]);
    expect(dl.suggestedFilename()).toContain('backup-');
    const body = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
    expect(body.invoices.length).toBe(2);
    expect(body._partial).toBeUndefined();
  });

  test('under the lock nobody is signed in: no file and nothing said', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await lockNow(page);
    const dl = await downloadOf(page, () => g(page, 'exportData()'));
    expect(dl).toBeNull();
    await expect(page.locator('#guardRoot')).toBeVisible();
    expect(await val(page, 'grdUser()')).toBeNull();
  });

  test('a save that did not land: another role is sent to the sync or the owner, never to the export', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    // The sync not set up on this device: the owner is named and no button is drawn.
    await g(page, `noteSaveFailure(STORAGE_KEY, 'made up for the test')`);
    const bar = page.locator('.inv-storage-bar');
    await expect(bar).toContainText('Ask the owner to export a backup from this device.');
    await expect(bar.locator('button')).toHaveCount(0);
    // Set up: the push is the way out.
    await g(page, `ghIsConfigured = function () { return true; }; noteSaveFailure(STORAGE_KEY, 'made up for the test')`);
    await expect(bar).toHaveCount(1);
    await expect(bar).toContainText('Back it up to GitHub.');
    await expect(bar.locator('[data-action="invGhPush"]')).toBeVisible();
    await expect(bar.locator('[data-action="invExportData"]')).toHaveCount(0);
  });
});
