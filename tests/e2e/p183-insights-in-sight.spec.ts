import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState } from './fixtures';

// P183 (owner, 8 Oct 2026): "Insights seems to be missing on mobile?" Insights became Office's group that day, after Clients,
// and Office's row ran past the phone's edge with nothing naming what lay beyond: Stats was half a word at the edge and Reports,
// Planner, History and Knowledge were out of sight. The group's name heads it and waits at the row's right edge until the group
// comes into view; a tap on it brings the group in. Since the tab map (9 Oct 2026) the Insights are Today's, and Today's row
// fits a phone: there the name is a rule between Pulse and Stats, and the word is kept for a row that does not fit. A page's
// own tab row that runs past the screen fades on the side with more, so a view out of sight reads as further along.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
// Where things stand in the workspace's row. A tab before the group is measured by its word, not its box: the name may sit over
// the tab's padding.
const rects = (p: Page, before: string) => g(p, `(function() {
  var row = document.getElementById('wsTabs'), q = function(s) { var b = document.querySelector('#wsTabs ' + s).getBoundingClientRect(); return [b.left, b.right]; };
  var rg = document.createRange(); rg.selectNodeContents(document.querySelector('#wsTabs ${before}'));
  var cw = rg.getBoundingClientRect(), rb = row.getBoundingClientRect();
  return { row: [rb.left, rb.right], over: row.scrollWidth > row.clientWidth + 1, name: q('.inv-viewtab-group'), before: [cw.left, cw.right],
    stats: q('[data-tab="pageStats"]'), last: q('.inv-viewtab:last-child'), mask: getComputedStyle(row).maskImage, group: row.getAttribute('data-group') };
})()`) as Promise<{ row: number[]; over: boolean; name: number[]; before: number[]; stats: number[]; last: number[]; mask: string; group: string | null }>;

test.describe('P183: a group of a workspace\'s views is named where the phone can see it', () => {
  // The tab map (9 Oct 2026): the Insights are Today's, after Needs you and Pulse, and every row fits a phone (§3a-4).
  for (const width of [393, 360]) {
    test(`a ${width} px phone: Today's row fits, the Insights set off by a rule between Pulse and Stats`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await loadAppWithState(page, emptyState());
      await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="today"]').click();
      const a = await rects(page, '[data-v="pulse"]');
      expect(a.group).toBe('rule');
      expect(a.over).toBe(false);
      // The rule stands after Pulse's word and before Stats; Planner, the last, is wholly in sight.
      expect(a.name[0]).toBeGreaterThanOrEqual(a.before[1] - 8);
      expect(a.name[1]).toBeLessThanOrEqual(a.stats[0] + 0.5);
      expect(a.last[1]).toBeLessThanOrEqual(a.row[1] + 0.5);
      expect(a.mask).toBe('none');
      // The name is still the group's, for whatever reads it, and the rule shows no word.
      await expect(page.locator('#wsTabs .inv-viewtab-group')).toHaveText('Insights');
      expect(await g(page, `getComputedStyle(document.querySelector('#wsTabs .inv-viewtab-group')).fontSize`)).toBe('0px');
    });
  }

  test('a row that does not fit names its group in a word at its right edge until the group is in view, and a tap brings it in', async ({ page }) => {
    // No row of the map is that long now (Office's ran to nine until 9 Oct 2026, its Insights out of sight): one is drawn here,
    // Office's five views and the three Insights again after their name, to keep the cue proven for a narrow phone or a
    // large font.
    await page.setViewportSize({ width: 393, height: 800 });
    await loadAppWithState(page, emptyState());
    await g(page, `(function() { var o = wsGet('office'); o.views = o.views.concat([{ tab: 'pageStats', label: 'Stats', group: 'Insights' },
      { tab: 'pageReports', label: 'Reports' }, { tab: 'pagePlanner', label: 'Planner' }]); })()`);
    await page.locator('.inv-navbar [data-action="invWsGo"][data-ws="office"]').click();
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
    const name = page.locator('#wsTabs .inv-viewtab-group');
    await expect(name).toHaveText('Insights');
    const a = await rects(page, '[data-v="prospects"]');
    expect(a.group).toBe('word');
    expect(a.over).toBe(true);
    // On screen at the row's right edge, and Stats beyond it.
    expect(a.name[0]).toBeGreaterThanOrEqual(a.row[0]);
    expect(a.name[1]).toBeLessThanOrEqual(a.row[1] + 0.5);
    expect(a.stats[1]).toBeGreaterThan(a.row[1]);
    // The workspace's row is not faded: the name is its cue, and a fade would wash it out.
    expect(a.mask).toBe('none');

    await name.click();
    await expect.poll(async () => { const b = await rects(page, '[data-v="prospects"]'); return b.stats[0] >= b.row[0] && b.stats[1] <= b.row[1]; }).toBe(true);
    const b = await rects(page, '[data-v="prospects"]');
    // The name heads its group; nothing was opened: the tap shows the group, it does not pick a view.
    expect(b.name[1]).toBeLessThanOrEqual(b.stats[0] + 0.5);
    await expect(page.locator('#pagePipeline')).toHaveClass(/inv-page-active/);
  });

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
