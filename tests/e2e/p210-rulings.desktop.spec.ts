import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { sweepState } from './sweep-fixture';

// P210 on the desktop: the owner's rulings of 13 Oct 2026 (see the phone file). The desktop drew the photo doors as buttons
// in the toolbar rather than under More.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

test.describe('P210: the photo reading came out (desktop)', () => {
  test('no Scan, Read register photo or Read page photo button on any toolbar', async ({ page }) => {
    await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
    await loadAppWithState(page, sweepState() as any);
    await switchTab(page, 'pageIM');
    await expect(page.locator('#pageIM [data-action="invShowAddChallan"]')).toBeVisible();
    await expect(page.locator('#pageIM .inv-toolbar')).not.toContainText('Scan');
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#pageProduction .inv-toolbar').first()).toBeVisible();
    await expect(page.locator('#pageProduction .inv-toolbar').first()).not.toContainText('photo');
    await g(page, `navOpen({ tab: 'pageStaff', v: 'register/${todayIso().slice(0, 7)}', id: '' })`);
    await expect(page.locator('[data-att-toolbar="register"]')).toBeVisible();
    await expect(page.locator('[data-att-toolbar="register"]')).not.toContainText('photo');
  });
});
