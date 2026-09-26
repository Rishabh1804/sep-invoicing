import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P58: two pages carry two sidebar entries each (Clients / Items, Staff / Pay). From Pay, Staff
// switched to the page already open, on the view already showing, and the screen did not move
// (owner, 26 Sep 2026); the same from Items to Clients.

const side = (page: any, label: string) => page.locator('.inv-side-item').filter({ hasText: new RegExp('^' + label + '$') });

test('from Pay, Staff opens the staff view; from Items, Clients opens the client list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadAppWithState(page, emptyState());

  await side(page, 'Pay').click();
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'pay');
  await side(page, 'Staff').click();
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'overview');
  await expect(side(page, 'Staff')).toHaveAttribute('aria-current', 'page');

  // A view that belongs to no other entry is kept: Staff from Week stays on Week.
  await page.locator('[data-action="invAttView"][data-view="week"]').click();
  await side(page, 'Staff').click();
  await expect(page.locator('[data-action="invAttView"].inv-chip-active')).toHaveAttribute('data-view', 'week');

  await side(page, 'Items').click();
  expect(await page.evaluate(() => (window as any).getItemsSubView())).toBe('items');
  await side(page, 'Clients').click();
  expect(await page.evaluate(() => (window as any).getItemsSubView())).toBe('clients');
  await expect(side(page, 'Clients')).toHaveAttribute('aria-current', 'page');
});
