import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';
import { PINS, lockNow, unlock, withUsers } from './p140-guard.fixture';

// P211 on the desktop: a step of the back trail an older build saved names the place it now opens, and is checked against the
// role there; Add's By hand lays out only the doors the role is shown. Every name is made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const book = () => { const s: any = emptyState(); s.incomingMaterial = noSeedIM(); return s; };
/* A step as an older build kept it: Stats → Overview, which moved to Today → Pulse (the tab map, TM2b; nav.js NAV_REDIRECTS). */
const OLD_STEP = `{ loc: { tab: 'pageStats', v: 'overview', id: '', d: '' }, ws: 'Insights', page: 'Stats', sub: 'Overview' }`;
/* Two doors of Add's By hand, read in one go once the dialog has finished scaling in (a box read mid-animation is scaled). */
async function doors(page: Page, a: string, b: string) {
  await page.waitForFunction(() => document.getAnimations().every(x => x.playState !== 'running'));
  return page.evaluate(([a, b]) => [a, b].map(go => {
    const r = document.querySelector(`[data-add-sec="hand"] .inv-btn-grid [data-go="${go}"]`)!.getBoundingClientRect();
    return { y: r.y, width: r.width };
  }), [a, b]);
}

test.describe('P211: the shell on the desktop', () => {
  test('A1-6: a trail step saved at a place that moved is named where it now opens', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageIM');
    const at = await g(page, `_navTrail[_navIdx - 1] = ${OLD_STEP}; navBarDraw(); _navIdx - 1`);
    // It read "Today › Stats · Overview", and opened Pulse.
    await expect(page.locator(`#navTrail [data-action="invNavGo"][data-to="${at}"]`)).toHaveText('Today › Pulse');
  });

  test('A1-6: and it is checked against the role where it now opens', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await switchTab(page, 'pageIM');
    // Office opens no Stats, and opens Today: the step is shown (it was hidden, checked against Stats).
    const at = await g(page, `_navTrail[_navIdx - 1] = ${OLD_STEP}; navBarDraw(); _navIdx - 1`);
    await expect(page.locator(`#navTrail [data-action="invNavGo"][data-to="${at}"]`)).toHaveText('Today › Pulse');
  });

  test('A1-8: Add’s By hand lays out only the doors the role is shown: Office’s Task sits in the row, not a row of its own', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-off', PINS.office);
    await page.locator('[data-action="invAddOpen"]:visible').first().click();
    const grid = page.locator('[data-add-sec="hand"] .inv-btn-grid');
    await expect(grid.locator('.inv-btn:visible')).toHaveCount(4);
    const [challan, task] = await doors(page, 'challan', 'task');
    expect(Math.abs(task.y - challan.y)).toBeLessThan(1);
    expect(Math.abs(task.width - challan.width)).toBeLessThan(1);
    // With every door shown (the owner's eleven), the last still takes its row alone.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-add-sheet]')).toHaveCount(0);
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await page.locator('[data-action="invAddOpen"]:visible').first().click();
    const all = page.locator('[data-add-sec="hand"] .inv-btn-grid');
    await expect(all.locator('.inv-btn:visible')).toHaveCount(11);
    const [first, last] = await doors(page, 'challan', 'task');
    expect(last.y).toBeGreaterThan(first.y);
    expect(last.width).toBeGreaterThan(first.width * 4);
  });
});
