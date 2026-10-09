import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P58: a page has one door. Clients / Items and Staff / Pay were two sidebar entries each, and from Pay, Staff switched to the
// page already open, on the view already showing: the screen did not move (owner, 26 Sep 2026). In DIRECTION_B Items and Pay
// are views inside Office → Clients and Floor → People. Since the rail (owner, 8 Oct 2026) the rail carries the workspaces
// alone and their views are the tab row, so the tab stays pressed on whichever of its page's views is open, and a workspace's
// door moves: to the view last open in it, or, on the workspace already open, to its first view. Since the tab map (TM1) one page
// can carry two tabs (Clients and Sales are pageClients), so a tab is named by its view too.

const tab = (page: any, id: string, v?: string) => page.locator(`#wsTabs [data-tab="${id}"]${v ? `[data-v="${v}"]` : ''}`);
const door = (page: any, ws: string) => page.locator(`#invSidebar [data-action="invWsGo"][data-ws="${ws}"]`);

test('one door a page: People stays pressed over Pay, Clients over Parts; a workspace door opens its view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadAppWithState(page, emptyState());
  await expect(page.locator('#invSidebar [data-sub], #invSidebar [data-action="invSideGo"], #invSidebar [data-tab]')).toHaveCount(0);

  await door(page, 'floor').click();
  await tab(page, 'pageStaff').click();
  await page.locator('[data-action="invAttView"][data-view="pay"]').click();
  await expect(page.locator('.inv-viewtab[data-action="invAttView"][aria-selected="true"]')).toHaveAttribute('data-view', 'pay');
  await expect(tab(page, 'pageStaff')).toHaveAttribute('aria-selected', 'true');
  await expect(door(page, 'floor')).toHaveAttribute('aria-current', 'true');

  await door(page, 'office').click();
  await tab(page, 'pageClients', 'clients').click();
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
  expect(await page.evaluate(() => (window as any).getItemsSubView())).toBe('items');
  await expect(tab(page, 'pageClients', 'clients')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'pageClients', 'prospects')).toHaveAttribute('aria-selected', 'false');
  await expect(door(page, 'office')).toHaveAttribute('aria-current', 'true');

  // Floor's door from Office: the view last open in Floor, as it was left (People, on Pay).
  await door(page, 'floor').click();
  await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
  await expect(page.locator('.inv-viewtab[data-action="invAttView"][aria-selected="true"]')).toHaveAttribute('data-view', 'pay');
  // Floor's door with Floor open: its first view.
  await door(page, 'floor').click();
  const first = await page.evaluate(() => (window as any).wsViewsPresent('floor')[0].tab);
  await expect(page.locator('#' + first)).toHaveClass(/inv-page-active/);
  await expect(tab(page, first)).toHaveAttribute('aria-selected', 'true');
});
