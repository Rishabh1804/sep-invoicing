import { test, expect } from '@playwright/test';
import { loadAppWithState, waitForBoot, openSettingsAt } from './fixtures';
import { sweepState, sweep, problems, type Stop } from './sweep-fixture';
import { PINS, g, guardBook, withUsers, unlock } from './p140-guard.fixture';

// P140 (desktop): the guard on the desktop layout. How long an unlock takes on the sweep book, measured; who is signed in,
// in the desktop's top bar; the sidebar showing only the doors the role opens; a role's page taken away in Settings sending
// the window that had it open Home; and the lock, the menu and Users & access as two panes, swept like every other screen.

test.describe('P140: the guard (desktop)', () => {
  test('an unlock takes under 400 ms on the desktop project, on the sweep book', async ({ page }) => {
    await loadAppWithState(page, sweepState());
    await withUsers(page);
    const runs = await page.evaluate(async (pin) => {
      const w = window as any, S = (0, eval)('S');
      const secret = S.users.find((u: any) => u.role === 'owner').secret;
      const out: Array<{ ms: number; ok: boolean }> = [];
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        const ok = await w.grdVerify(secret, pin);
        out.push({ ms: Math.round(performance.now() - t), ok });
      }
      return { out, iter: secret.iter };
    }, PINS.owner);
    const ms = runs.out.map(r => r.ms).sort((a, b) => a - b);
    // The machine is shared with other test runs, so the quickest of three is the cost of the hash itself.
    console.log(`P140 unlock hash at ${runs.iter} iterations: best ${ms[0]} ms, median ${ms[1]} ms, all ${JSON.stringify(runs.out.map(r => r.ms))}`);
    expect(runs.out.every(r => r.ok)).toBe(true);
    expect(runs.iter).toBeGreaterThanOrEqual(150000);
    expect(ms[0]).toBeLessThan(400);
    // And the whole unlock, from the tap to the lock gone.
    const lock = page.locator('#guardRoot');
    await lock.locator('[data-id="U-own"]').click();
    await lock.locator('#grdPin').fill(PINS.owner);
    const t0 = Date.now();
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
    console.log(`P140 unlock, tap to open: ${Date.now() - t0} ms`);
  });

  test('who is signed in is in the top bar, and the sidebar shows only the doors the role opens', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('.inv-topbar #guardUserBtn')).toBeVisible();
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'BM');
    const side = page.locator('#invSidebar');
    for (const t of ['pageHome', 'pageTodo', 'pageProduction', 'pagePower', 'pageStock']) await expect(side.locator(`[data-tab="${t}"]`)).toBeVisible();
    await expect(side.locator('[data-tab="pageStaff"]:not([data-sub])')).toBeVisible();
    for (const t of ['pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pageFinance', 'pageStats', 'pageReports', 'pageHistory']) {
      await expect(side.locator(`[data-tab="${t}"]`)).toHaveCount(await side.locator(`[data-tab="${t}"][data-grd-off]`).count());
      await expect(side.locator(`[data-tab="${t}"]`).first()).toBeHidden();
    }
    // No wages: Pay's entry goes, and Staff opens without it. No Settings either.
    await expect(side.locator('[data-tab="pageStaff"][data-sub="pay"]')).toBeHidden();
    await expect(side.locator('[data-action="invOpenSettings"]')).toBeHidden();
    // The owner, after Switch user, has every door back.
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardSwitch"]').click();
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'AR');
    for (const t of ['pageIM', 'pageRegister', 'pageFinance', 'pageStats', 'pageHistory']) await expect(side.locator(`[data-tab="${t}"]`).first()).toBeVisible();
    await expect(side.locator('[data-tab="pageStaff"][data-sub="pay"]')).toBeVisible();
    await expect(page.locator('[data-grd-off]')).toHaveCount(0);
  });

  test('a page taken from a role in Settings sends the window that has it open Home, with a word', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    const other = await page.context().newPage();
    await other.setViewportSize({ width: 1280, height: 800 });
    await other.goto('/');
    await waitForBoot(other);
    await unlock(other, 'U-sup', PINS.super);
    await other.locator('#invSidebar [data-tab="pageStock"]').click();
    await expect(other.locator('#pageStock')).toHaveClass(/inv-page-active/);
    // The owner takes Stock from the supervisor: a switch in the roles' grid, and the section's Save.
    await openSettingsAt(page, 'users');
    const grid = page.locator('[data-grd-roles]');
    await expect(grid.locator('th')).toHaveText(['Opens, may change', 'Office', 'Supervisor', 'Floor']);
    await grid.locator('[data-grd-role="supervisor"][data-grd-pg="pageStock"]').uncheck();
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="users"]').click();
    await expect(page.locator('details[data-sec="users"] [data-unsaved]')).toHaveCount(0);
    // The other window loads the book, finds the page on screen no longer its role's, and goes Home.
    await expect(other.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(other.locator('.inv-toast')).toHaveText('Your ID doesn’t open Stock');
    await expect(other.locator('#invSidebar [data-tab="pageStock"]')).toBeHidden();
    await other.close();
  });

  test('the lock, the menu and Users & access as two panes are drawn from the components', async ({ page }) => {
    test.setTimeout(120_000);
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    const stops: Stop[] = [];
    stops.push(await sweep(page, 'lock'));
    stops[stops.length - 1].blank = false;   // the lock hides the page on purpose
    await unlock(page, 'U-own', PINS.owner);
    await page.locator('#guardUserBtn').click();
    await expect(page.locator('[data-grd-menu]')).toBeVisible();
    stops.push(await sweep(page, 'user menu'));
    await g(page, 'closeOverlay()');
    await openSettingsAt(page, 'users');
    await expect(page.locator('.inv-dialog-nav [data-group="access"]')).toHaveAttribute('aria-current', 'true');
    stops.push(await sweep(page, 'settings, users & access'));
    await g(page, "grdFormOpen('add')");
    stops.push(await sweep(page, 'add user, over Settings'));
    expect(problems(stops)).toEqual([]);
  });
});
