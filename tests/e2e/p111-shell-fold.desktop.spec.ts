import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P111 desktop: the shell's share of the QA sweep of 29 Sep 2026, where the desktop differs.
test("the installed app's New challan shortcut opens the form on the desktop too", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, emptyState());
  await page.goto('/?tab=pageIM&new=1');
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#imChallanClientSearch')).toBeVisible();
});
