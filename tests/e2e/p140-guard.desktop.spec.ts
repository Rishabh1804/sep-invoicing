import { test, expect } from '@playwright/test';
import { loadAppWithState, waitForBoot, openSettingsAt } from './fixtures';
import { sweepState, sweep, problems, type Stop } from './sweep-fixture';
import { PINS, g, guardBook, withUsers, unlock } from './p140-guard.fixture';

// P140 (desktop): the guard on the desktop layout. How long an unlock takes on the sweep book, measured; who is signed in,
// in the desktop's top bar; the rail and the tab rows showing only the doors the role opens; a role's page taken away in Settings sending
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
    // And the whole unlock, from the tap to the lock gone, timed in the page (the test's own polling would add its steps).
    const lock = page.locator('#guardRoot');
    await lock.locator('[data-id="U-own"]').click();
    await lock.locator('#grdPin').fill(PINS.owner);
    await page.evaluate(() => {
      const w = window as any;
      w.__grdT0 = 0; w.__grdT1 = 0;
      document.addEventListener('click', e => { if ((e.target as Element).closest('[data-action="invGuardUnlock"]')) w.__grdT0 = performance.now(); }, true);
      new MutationObserver(() => { if (w.__grdT0 && !w.__grdT1 && !document.getElementById('guardRoot')) w.__grdT1 = performance.now(); })
        .observe(document.body, { childList: true });
    });
    await lock.locator('[data-action="invGuardUnlock"]').click();
    await expect(lock).toHaveCount(0);
    const open = await page.evaluate(() => Math.round((window as any).__grdT1 - (window as any).__grdT0));
    console.log(`P140 unlock, tap to open: ${open} ms`);
    expect(open).toBeGreaterThan(0);
  });

  test('who is signed in is in the top bar, and the rail and the tab rows show only the doors the role opens', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('.inv-topbar #guardUserBtn')).toBeVisible();
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'BM');
    const side = page.locator('#invSidebar');
    // The rail: a workspace's door only where the role opens one of its views. The supervisor's Floor, never Money.
    const seen = await page.evaluate(() => (window as any).WORKSPACES.filter((w: any) => (window as any).wsViewsPresent(w).length).map((w: any) => w.id)) as string[];
    expect(seen).toContain('floor');
    expect(seen).not.toContain('money');
    await expect(side.locator('.inv-side-item[data-ws]')).toHaveCount(seen.length);
    await expect(side.locator('[data-ws="money"]')).toHaveCount(0);
    // Floor's row: its five views. Office's, when the role opens any of it: none of the pages the role does not.
    await side.locator('[data-ws="floor"]').click();
    for (const t of ['pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower']) await expect(page.locator(`#wsTabs [data-tab="${t}"]`)).toBeVisible();
    if (seen.includes('office')) {
      await side.locator('[data-ws="office"]').click();
      for (const t of ['pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pageFinance', 'pageStats', 'pageReports', 'pageHistory']) {
        await expect(page.locator(`#wsTabs [data-tab="${t}"]`)).toHaveCount(0);
      }
    }
    // No wages: Pay's tab goes, and Staff opens without it. No Settings either.
    await side.locator('[data-ws="floor"]').click();
    await page.locator('#wsTabs [data-tab="pageStaff"]').click();
    await expect(page.locator('#pageStaff [data-action="invAttView"][data-view="pay"]')).toHaveCount(0);
    await expect(side.locator('[data-action="invOpenSettings"]')).toBeHidden();
    // The owner, after Switch user, has every door back.
    await page.locator('#guardUserBtn').click();
    await page.locator('[data-grd-menu] [data-action="invGuardSwitch"]').click();
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('#guardUserBtn')).toHaveAttribute('data-initials', 'AR');
    await expect(side.locator('.inv-side-item[data-ws]')).toHaveCount(4);
    await expect(side.locator('[data-ws="money"]')).toBeVisible();
    await side.locator('[data-ws="office"]').click();
    for (const t of ['pageIM', 'pageRegister', 'pageClients']) await expect(page.locator(`#wsTabs [data-tab="${t}"]`).first()).toBeVisible();
    // The Insights are Today's, and History is the top bar's tool (the tab map, 9 Oct 2026).
    await side.locator('[data-ws="today"]').click();
    for (const t of ['pageStats', 'pageReports', 'pagePlanner']) await expect(page.locator(`#wsTabs [data-tab="${t}"]`)).toBeVisible();
    await expect(page.locator('.inv-topbar [data-action="invGoHistory"]:visible')).toHaveCount(1);
    await side.locator('[data-ws="floor"]').click();
    await page.locator('#wsTabs [data-tab="pageStaff"]').click();
    await expect(page.locator('#pageStaff [data-action="invAttView"][data-view="pay"]').first()).toBeVisible();
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
    await other.locator('#invSidebar [data-ws="floor"]').click();
    await other.locator('#wsTabs [data-tab="pageStock"]').click();
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
    await other.locator('#invSidebar [data-ws="floor"]').click();
    await expect(other.locator('#wsTabs [data-tab="pageStock"]')).toHaveCount(0);
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
