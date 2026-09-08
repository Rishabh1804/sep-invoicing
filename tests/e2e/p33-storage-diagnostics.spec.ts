import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, todayIso, recentTs, STORAGE_KEY } from './fixtures';

/*
 * Storage health.
 *
 * A phone held a 12 Aug copy of the books for four weeks while every import
 * reported "Data imported". Three silences stacked: the save caught every
 * error as "Storage full!", the import's success toast replaced that toast in
 * the same tick, and nothing read the value back to see whether the browser
 * had kept it. Each of those is pinned here, plus the diagnostics that turn
 * the device into an instrument.
 */

function stateWithInvoice() {
  const s = emptyState();
  (s as any).invoices = [{
    id: 'inv-1', displayNumber: 'SEP/2026-27/00001', number: 1, clientId: 1,
    date: todayIso(), createdAt: recentTs(), items: [], subtotal: 0, total: 0,
    status: 'active', invoiceState: 'created',
  }];
  return s;
}

// Make the browser refuse (or silently drop) writes to the state key only,
// so the app's own reaction is what gets measured.
async function breakStateWrites(page: import('@playwright/test').Page, mode: 'throw' | 'drop') {
  await page.evaluate(([key, m]) => {
    const orig = Storage.prototype.setItem;
    (window as any).__origSetItem = orig;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) {
        if (m === 'throw') throw new DOMException('Setting the value of ' + k + ' exceeded the quota.', 'QuotaExceededError');
        return; // dropped without a word
      }
      return orig.call(this, k, v);
    };
  }, [STORAGE_KEY, mode] as const);
}
async function restoreWrites(page: import('@playwright/test').Page) {
  await page.evaluate(() => { Storage.prototype.setItem = (window as any).__origSetItem; });
}

test.describe('a save that does not land is said so', () => {
  test('a refused write raises a banner naming the browser error, and the next good save clears it', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await breakStateWrites(page, 'throw');

    const ok = await page.evaluate(() => (window as any).saveState());
    expect(ok).toBe(false);
    const bar = page.locator('.inv-storage-bar');
    await expect(bar).toHaveCount(1);
    await expect(bar).toContainText('QuotaExceededError');
    await expect(bar).toContainText('memory only');
    await expect(bar.locator('[data-action="invExportData"]')).toBeVisible();

    await restoreWrites(page);
    const ok2 = await page.evaluate(() => (window as any).saveState());
    expect(ok2).toBe(true);
    await expect(bar).toHaveCount(0);
  });

  test('a write the browser drops without throwing is caught by the read-back', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await breakStateWrites(page, 'drop');
    const ok = await page.evaluate("S.company.name = 'CHANGED'; saveState()");
    expect(ok).toBe(false);
    await expect(page.locator('.inv-storage-bar')).toContainText('not persisted');
  });

  test('Settings → Import refuses to say "imported" when the copy only reached memory', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await breakStateWrites(page, 'throw');
    page.on('dialog', d => d.accept());

    await page.locator('[data-action="invOpenSettings"]').first().click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="invImportData"]').click();
    const incoming = stateWithInvoice();
    incoming.company.name = 'IMPORTED CO';
    await (await chooser).setFiles({
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(incoming)),
    });

    // The data is in memory — the app renders it — but the toast says so.
    await expect(page.locator('.inv-toast-error')).toContainText('NOT saved');
    await expect(page.locator('.inv-toast-success')).toHaveCount(0);
    await expect(page.locator('.inv-storage-bar')).toHaveCount(1);
    expect(await page.evaluate('S.company.name')).toBe('IMPORTED CO');

    // And a fresh open proves the point the toast made: the disk still has the
    // old copy. (A fresh page rather than a reload — loadAppWithState seeds
    // storage from an init script that re-runs on every navigation of THIS
    // page, which would make a reload assertion pass whatever the app did.)
    const fresh = await page.context().newPage();
    await fresh.goto('/');
    await fresh.waitForSelector('nav.inv-tabs', { state: 'attached' });
    expect(await fresh.evaluate('S.company.name')).not.toBe('IMPORTED CO');
  });

  test('a good import still says so', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    page.on('dialog', d => d.accept());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="invImportData"]').click();
    const incoming = stateWithInvoice();
    incoming.company.name = 'IMPORTED CO';
    await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
    await expect(page.locator('.inv-toast-success')).toHaveText('Data imported');
    const fresh = await page.context().newPage();
    await fresh.goto('/');
    await fresh.waitForSelector('nav.inv-tabs', { state: 'attached' });
    expect(await fresh.evaluate('S.company.name')).toBe('IMPORTED CO');
  });
});

test.describe('storage diagnostics', () => {
  test('Settings reports what is on disk and whether the last save landed', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await page.evaluate(() => (window as any).saveState());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('.inv-storage-text').filter({ hasText: 'on disk' })).toContainText('matches memory');
    await expect(page.locator('.inv-save-status')).toContainText('ok at');
  });

  test('the report names the newest record on disk, the headroom, and the failing error', async ({ page }) => {
    const s = stateWithInvoice();
    await loadAppWithState(page, s);
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('[data-action="invRunDiagnostics"]').click();

    const report = page.locator('.inv-diag-report');
    await expect(report).toContainText('Build: ');
    await expect(report).toContainText('On disk: ');
    await expect(report).toContainText('newest invoice date ' + todayIso());
    await expect(report).toContainText('1 invoices');
    // Chromium takes at least a megabyte more beside a tiny state.
    await expect(report).toContainText(/Headroom: accepted an extra [1-9]/);
    // The probe leaves nothing behind.
    expect(await page.evaluate(() => localStorage.getItem('sep_inv_probe'))).toBeNull();

    // Disk and memory disagreeing is the phone's exact symptom, and the
    // report has to say so rather than average it away.
    await breakStateWrites(page, 'throw');
    await page.evaluate("S.company.name = 'UNSAVED'; saveState()");
    await page.locator('[data-action="invRunDiagnostics"]').click();
    await expect(report).toContainText('DIFFERS from memory');
    await expect(report).toContainText('Last save: FAILED');
    await expect(report).toContainText('QuotaExceededError');
  });

  test('a read that throws at load is reported, not silently replaced with an empty book', async ({ page }) => {
    await page.addInitScript((key) => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k: string) {
        if (k === key) throw new DOMException('Access is denied for this document.', 'SecurityError');
        return orig.call(this, k);
      };
    }, STORAGE_KEY);
    await page.goto('/');
    await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
    const bar = page.locator('.inv-storage-bar');
    await expect(bar).toContainText('refused to read');
    await expect(bar).toContainText('SecurityError');
  });
});
