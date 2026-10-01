import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { imState } from './im-fixture';

// P100 desktop: a record open in the pane is a place with an address, and the top bar carries the trail beside the arrow,
// each earlier step a link back to it. The top bar names the workspace, then the page, its view and the record
// (DIRECTION_B: "Office › Challans · Awaiting invoice"); a step names its workspace where the next is in another.

test('the trail names the earlier steps; a step opens where it was; a record reopens by its address', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, imState());
  await switchTab(page, 'pageIM');
  await page.locator('#imMaster button[data-action="invSelectIMRow"][data-id="IM-102"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('id')).toBe('IM-102');
  await expect(page.locator('#topbarTitle')).toHaveText('Office');
  await expect(page.locator('#topbarCtx')).toHaveText('Challans · Awaiting invoice · Ch. 102');
  await switchTab(page, 'pageStats');
  const trail = page.locator('#navTrail [data-action="invNavGo"]');
  await expect(trail).toHaveText(['Today', 'Awaiting invoice', 'Office › Challans · Awaiting invoice · Ch. 102']);
  await expect(page.locator('#topbarTitle')).toHaveText('Insights');
  await expect(page.locator('#navBack')).toBeVisible();
  await trail.nth(1).click();
  await expect(page.locator('#pageIM')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#imDetail')).toBeEmpty();
  await page.goForward();
  await expect(page.locator('#imDetail')).toContainText('Total');

  // The address alone opens the record.
  await page.goto('/?tab=pageIM&v=awaiting&id=IM-101');
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await expect(page.locator('#imDetail .inv-panel-title')).toHaveText('Ch. 101');
});
