import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, waitForBoot, todayIso, recentTs, STORAGE_KEY } from './fixtures';

/*
 * Storage health, on the IndexedDB store.
 *
 * A phone held a 12 Aug copy of the books for four weeks while every import
 * reported "Data imported". Three silences stacked: the save caught every
 * error as "Storage full!", the import's success toast replaced that toast in
 * the same tick, and nothing read the value back to see whether the browser
 * had kept it. Each of those is pinned here, plus the migration off the
 * localStorage key whose per-origin quota — shared with the sister apps on
 * rishabh1804.github.io — was the actual cause.
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

// Make the store refuse (or silently drop) writes of the state, so the app's
// own reaction is what gets measured. A 'drop' writes under a different key,
// so the read-back of the real one returns whatever was there before.
async function breakStateWrites(page: Page, mode: 'throw' | 'drop') {
  await page.evaluate(async (m) => {
    const orig = IDBObjectStore.prototype.put;
    (window as any).__origPut = orig;
    IDBObjectStore.prototype.put = function (value: any, key?: any) {
      if (m === 'throw') throw new DOMException('Setting the value of ' + key + ' exceeded the quota.', 'QuotaExceededError');
      return orig.call(this, value, 'elsewhere'); // dropped without a word
    };
  }, mode);
}
async function restoreWrites(page: Page) {
  await page.evaluate(async () => { IDBObjectStore.prototype.put = (window as any).__origPut; });
}

test.describe('a save that does not land is said so', () => {
  test('a refused write raises a banner naming the browser error, and the next good save clears it', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await breakStateWrites(page, 'throw');

    const ok = await page.evaluate(async () => (window as any).saveState());
    expect(ok).toBe(false);
    const bar = page.locator('.inv-storage-bar');
    await expect(bar).toHaveCount(1);
    await expect(bar).toContainText('QuotaExceededError');
    await expect(bar).toContainText('memory only');
    await expect(bar.locator('[data-action="invExportData"]')).toBeVisible();

    await restoreWrites(page);
    const ok2 = await page.evaluate(async () => (window as any).saveState());
    expect(ok2).toBe(true);
    await expect(bar).toHaveCount(0);
  });

  test('a write the store drops without throwing is caught by the read-back', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await breakStateWrites(page, 'drop');
    const ok = await page.evaluate("S.company.name = 'CHANGED'; saveState()");
    expect(ok).toBe(false);
    await expect(page.locator('.inv-storage-bar')).toContainText('not persisted');
    // And the store still holds the copy from before the dropped write.
    expect((await readStoredState(page)).company.name).not.toBe('CHANGED');
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

    // A fresh open proves the point the toast made: the store still has the
    // old copy. (A fresh page rather than a reload — loadAppWithState seeds
    // the legacy key from an init script that re-runs on every navigation of
    // THIS page; the store wins, but a fresh page keeps the assertion honest.)
    const fresh = await page.context().newPage();
    await fresh.goto('/');
    await waitForBoot(fresh);
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
    await waitForBoot(fresh);
    expect(await fresh.evaluate('S.company.name')).toBe('IMPORTED CO');
  });
});

test.describe('the store', () => {
  test('a legacy localStorage copy is migrated in and then removed from the shared pool', async ({ page }) => {
    const s = stateWithInvoice();
    s.company.name = 'LEGACY CO';
    await loadAppWithState(page, s);           // seeds the legacy key; boot migrates it
    expect(await page.evaluate('S.company.name')).toBe('LEGACY CO');
    await page.evaluate(async () => (window as any).saveState());
    expect((await readStoredState(page)).company.name).toBe('LEGACY CO');
    expect(await page.evaluate(async (k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();

    // With the store populated the legacy key is no longer consulted, so a
    // stale copy left there by an old build cannot roll the books back.
    await page.evaluate(async (k) => localStorage.setItem(k, JSON.stringify({ company: { name: 'STALE' }, clients: [] })), STORAGE_KEY);
    const fresh = await page.context().newPage();
    await fresh.goto('/');
    await waitForBoot(fresh);
    expect(await fresh.evaluate('S.company.name')).toBe('LEGACY CO');
  });

  test('a change survives a reload through the store', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    const ok = await page.evaluate("S.company.name = 'RENAMED CO'; saveState()");
    expect(ok).toBe(true);
    await page.reload();
    await waitForBoot(page);
    expect(await page.evaluate('S.company.name')).toBe('RENAMED CO');
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
    await waitForBoot(page);
    const bar = page.locator('.inv-storage-bar');
    await expect(bar).toContainText('could not read');
    await expect(bar).toContainText('SecurityError');
    // And the store is read-only for the session: the seeds that ran at boot
    // did not write a default book over the copy that would not open.
    expect(await page.evaluate(async () => (window as any).saveState())).toBe(false);
    expect(await page.evaluate(async () => (window as any).readPersistedStateRaw())).toBeNull();
    await expect(bar).toHaveCount(1);
  });
});

test.describe('storage diagnostics', () => {
  test('Settings reports what is on disk and whether the last save landed', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await page.evaluate(async () => (window as any).saveState());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('.inv-disk-summary')).toContainText('matches memory');
    await expect(page.locator('.inv-save-status')).toContainText('ok at');
  });

  test('the report names the store, the quota, the newest record on disk, and the failing error', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    await page.evaluate(async () => (window as any).saveState());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('[data-action="invRunDiagnostics"]').click();

    const report = page.locator('.inv-diag-report');
    await expect(report).toContainText('Build: ');
    await expect(report).toContainText('Store: IndexedDB sep-invoicing/state (verified writes)');
    await expect(report).toContainText(/Quota: using .* of .* available to this origin/);
    await expect(report).toContainText('On disk: ');
    await expect(report).toContainText('newest invoice date ' + todayIso());
    await expect(report).toContainText('1 invoices');
    // The legacy copy was migrated at boot and handed back to the shared pool.
    await expect(report).toContainText('Legacy localStorage copy: removed');
    // Chromium's localStorage takes at least a megabyte more beside nothing.
    await expect(report).toContainText(/localStorage headroom: accepted an extra [1-9]/);
    // The probe leaves nothing behind.
    expect(await page.evaluate(async () => localStorage.getItem('sep_inv_probe'))).toBeNull();

    // Disk and memory disagreeing is the phone's exact symptom, and the
    // report has to say so rather than average it away.
    await breakStateWrites(page, 'throw');
    await page.evaluate("S.company.name = 'UNSAVED'; saveState()");
    await page.locator('[data-action="invRunDiagnostics"]').click();
    await expect(report).toContainText('DIFFERS from memory');
    await expect(report).toContainText('Last save: FAILED');
    await expect(report).toContainText('QuotaExceededError');
  });

  test('the report lists every localStorage key on the origin by size, so a sister app spending the pool is visible', async ({ page }) => {
    await loadAppWithState(page, stateWithInvoice());
    // Another GitHub Pages project under the same account (SproutLab) lands
    // on the same origin, and therefore inside the same localStorage quota.
    await page.evaluate(async () => localStorage.setItem('sproutlab_state', 'x'.repeat(300 * 1024)));
    await page.evaluate(async () => (window as any).saveState());
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await page.locator('[data-action="invRunDiagnostics"]').click();
    const report = page.locator('.inv-diag-report');
    await expect(report).toContainText('one pool for every app served from this origin');
    await expect(report).toContainText('sproutlab_state: 300K chars');
    // The state itself is no longer in that pool.
    await expect(report).not.toContainText(/sep_invoicing_state: \d+K chars/);
    // Names only: a credential key is listed by size, its value never printed.
    await page.evaluate(async () => localStorage.setItem('sep_inv_github_token', 'ghp_SECRETVALUE'));
    await page.locator('[data-action="invRunDiagnostics"]').click();
    await expect(report).toContainText('sep_inv_github_token: 0K chars');
    await expect(report).not.toContainText('ghp_SECRETVALUE');
  });
});
