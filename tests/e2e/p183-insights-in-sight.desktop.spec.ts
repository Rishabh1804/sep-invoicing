import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P183 on the desktop (owner, 8 Oct 2026: "Insights seems to be missing on mobile?"). Where Office's row fits, the group's name
// stands between Clients and Stats behind a hairline, nothing fades, and a tap on the name moves nothing.

test('the name stands between Clients and Stats, the row fits, and the name moves nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, emptyState());
  await page.locator('#invSidebar [data-action="invWsGo"][data-ws="office"]').click();
  await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
  const name = page.locator('#wsTabs .inv-viewtab-group');
  await expect(name).toHaveText('Insights');
  const m = await page.evaluate(() => {
    const row = document.getElementById('wsTabs')!, q = (s: string) => document.querySelector('#wsTabs ' + s)!.getBoundingClientRect();
    return { over: row.scrollWidth > row.clientWidth + 1, more: row.getAttribute('data-more'), clients: q('[data-tab="pageClients"]').right,
      name: [q('.inv-viewtab-group').left, q('.inv-viewtab-group').right], stats: q('[data-tab="pageStats"]').left };
  });
  expect(m.over).toBe(false);
  expect(m.more).toBeNull();
  expect(m.name[0]).toBeGreaterThanOrEqual(m.clients - 0.5);
  expect(m.name[1]).toBeLessThanOrEqual(m.stats + 0.5);
  await name.click();
  await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
  expect(await page.evaluate(() => document.getElementById('wsTabs')!.scrollLeft)).toBe(0);
});
