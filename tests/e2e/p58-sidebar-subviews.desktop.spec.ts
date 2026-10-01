import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P58: a page has one sidebar entry. Clients / Items and Staff / Pay were two entries each, and from Pay, Staff switched to
// the page already open, on the view already showing: the screen did not move (owner, 26 Sep 2026). In DIRECTION_B Items
// and Pay are views inside Office → Clients and Floor → People, so the entry stays on whichever of its page's views is
// open, and a workspace's head moves: to the view last open in it, or, on the workspace already open, to its first view.

const side = (page: any, label: string) => page.locator('.inv-side-item').filter({ hasText: new RegExp('^' + label + '$') });

test('one entry a page: People stays on over Pay, Clients over Items; a workspace head opens its view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadAppWithState(page, emptyState());
  await expect(page.locator('#invSidebar [data-sub], #invSidebar [data-action="invSideGo"]')).toHaveCount(0);

  await side(page, 'People').click();
  await page.locator('[data-action="invAttView"][data-view="pay"]').click();
  await expect(page.locator('.inv-viewtab[data-action="invAttView"][aria-selected="true"]')).toHaveAttribute('data-view', 'pay');
  await expect(side(page, 'People')).toHaveAttribute('aria-current', 'page');

  await side(page, 'Clients').click();
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
  expect(await page.evaluate(() => (window as any).getItemsSubView())).toBe('items');
  await expect(side(page, 'Clients')).toHaveAttribute('aria-current', 'page');

  // Floor's head from Office: the view last open in Floor, as it was left (People, on Pay).
  await page.locator('.inv-side-item[data-ws="floor"]').click();
  await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
  await expect(page.locator('.inv-viewtab[data-action="invAttView"][aria-selected="true"]')).toHaveAttribute('data-view', 'pay');
  // Floor's head with Floor open: its first view.
  await page.locator('#invSidebar [data-action="invWsGo"][data-ws="floor"]').click();
  const first = await page.evaluate(() => (window as any).wsViewsPresent('floor')[0].tab);
  await expect(page.locator('#' + first)).toHaveClass(/inv-page-active/);
  await expect(page.locator('.inv-side-item[data-tab="' + first + '"]')).toHaveAttribute('aria-current', 'page');
});
