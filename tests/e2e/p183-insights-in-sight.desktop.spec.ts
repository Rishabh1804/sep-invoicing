import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P183 on the desktop (owner, 8 Oct 2026: "Insights seems to be missing on mobile?"). Where a workspace's row fits, the group's
// name stands between its views behind a hairline, nothing fades, and a tap on the name moves nothing. Since the tab map (9 Oct
// 2026) the Insights are Today's: the name stands between Pulse and Stats, a word on the desktop as before.

test('the name stands between Pulse and Stats, the row fits, and the name moves nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, emptyState());
  await page.locator('#invSidebar [data-action="invWsGo"][data-ws="today"]').click();
  await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  const name = page.locator('#wsTabs .inv-viewtab-group');
  await expect(name).toHaveText('Insights');
  const m = await page.evaluate(() => {
    const row = document.getElementById('wsTabs')!, q = (s: string) => document.querySelector('#wsTabs ' + s)!.getBoundingClientRect();
    return { over: row.scrollWidth > row.clientWidth + 1, more: row.getAttribute('data-more'), group: row.getAttribute('data-group'),
      pulse: q('[data-v="pulse"]').right, name: [q('.inv-viewtab-group').left, q('.inv-viewtab-group').right], stats: q('[data-tab="pageStats"]').left,
      size: getComputedStyle(document.querySelector('#wsTabs .inv-viewtab-group')!).fontSize };
  });
  expect(m.over).toBe(false);
  expect(m.more).toBeNull();
  // The phone's rule is the phone's: the desktop keeps the word.
  expect(m.group).toBeNull();
  expect(m.size).not.toBe('0px');
  expect(m.name[0]).toBeGreaterThanOrEqual(m.pulse - 0.5);
  expect(m.name[1]).toBeLessThanOrEqual(m.stats + 0.5);
  const before = await page.evaluate(() => (document.querySelector('.inv-page-active') as HTMLElement).id);
  await name.click();
  await expect(page.locator('#' + before)).toHaveClass(/inv-page-active/);
  expect(await page.evaluate(() => document.getElementById('wsTabs')!.scrollLeft)).toBe(0);
});
