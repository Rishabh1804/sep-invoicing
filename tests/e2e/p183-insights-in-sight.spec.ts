import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P183 (owner, 8 Oct 2026): "Insights seems to be missing on mobile?" Insights became Office's group that day, after Clients,
// and Office's row ran past the phone's edge with nothing naming what lay beyond: Stats was half a word at the edge and Reports,
// Planner, History and Knowledge were out of sight. The group's name now heads it and waits at the row's right edge until the
// group comes into view; a tap on it brings the group in. A page's own tab row that runs past the screen fades on the side
// with more, so a view out of sight reads as further along.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
// Where things stand in Office's row. Clients is measured by its word, not its box: the name may sit over the tab's padding.
const rects = (p: Page) => g(p, `(function() {
  var row = document.getElementById('wsTabs'), q = function(s) { var b = document.querySelector('#wsTabs ' + s).getBoundingClientRect(); return [b.left, b.right]; };
  var rg = document.createRange(); rg.selectNodeContents(document.querySelector('#wsTabs [data-tab="pageClients"]'));
  var cw = rg.getBoundingClientRect(), rb = row.getBoundingClientRect();
  return { row: [rb.left, rb.right], over: row.scrollWidth > row.clientWidth + 1, name: q('.inv-viewtab-group'), clients: [cw.left, cw.right],
    stats: q('[data-tab="pageStats"]'), mask: getComputedStyle(row).maskImage };
})()`) as Promise<{ row: number[]; over: boolean; name: number[]; clients: number[]; stats: number[]; mask: string }>;

test.describe('P183: Office names its Insights where the phone can see them', () => {
  for (const width of [393, 360]) {
    test(`a ${width} px phone: the name stands in sight after Clients, and a tap brings the group in`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await loadAppWithState(page, emptyState());
      await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="office"]').click();
      await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
      const name = page.locator('#wsTabs .inv-viewtab-group');
      await expect(name).toHaveText('Insights');
      const a = await rects(page);
      expect(a.over).toBe(true);
      // On screen, after Clients' word (its fade may reach the word's last pixels, never its body), and Stats beyond it.
      expect(a.name[0]).toBeGreaterThanOrEqual(a.row[0]);
      expect(a.name[1]).toBeLessThanOrEqual(a.row[1] + 0.5);
      expect(a.name[0]).toBeGreaterThanOrEqual(a.clients[1] - 8);
      expect(a.stats[1]).toBeGreaterThan(a.row[1]);
      // The workspace's row is not faded: the name is its cue, and a fade would wash it out.
      expect(a.mask).toBe('none');

      await name.click();
      await expect.poll(async () => { const b = await rects(page); return b.stats[0] >= b.row[0] && b.stats[1] <= b.row[1]; }).toBe(true);
      const b = await rects(page);
      // The name heads its group at the row's left; nothing was opened: the tap shows the group, it does not pick a view.
      expect(b.name[0]).toBeGreaterThanOrEqual(b.row[0] - 1);
      expect(b.name[1]).toBeLessThanOrEqual(b.stats[0] + 0.5);
      await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
      await page.locator('#wsTabs [data-tab="pageReports"]').click();
      await expect(page.locator('#pageReports')).toHaveClass(/inv-page-active/);
      expect(await g(page, `(function() { var r = document.getElementById('wsTabs').getBoundingClientRect(), t = document.querySelector('#wsTabs [aria-selected="true"]').getBoundingClientRect();
        return t.left >= r.left - 0.5 && t.right <= r.right + 0.5; })()`)).toBe(true);
    });
  }

  test(`a page's own tab row that runs past the screen fades on the side with more`, async ({ page }) => {
    await loadAppWithState(page, emptyState());
    // People's seven views are wider than a phone.
    await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="floor"]').click();
    await page.locator('#wsTabs [data-tab="pageStaff"]').click();
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    const row = page.locator('#pageStaff .inv-viewtabs').first();
    await expect(row).toHaveAttribute('data-more', 'end');
    expect(await row.evaluate(r => getComputedStyle(r).maskImage)).toContain('gradient');
    await row.evaluate(r => { r.scrollLeft = r.scrollWidth; });
    await expect(row).toHaveAttribute('data-more', 'start');
    await row.evaluate(r => { r.scrollLeft = 20; });
    await expect(row).toHaveAttribute('data-more', 'both');
  });
});
