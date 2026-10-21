import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, switchTab, toolbarMore, type SepState, openNeeds } from './fixtures';
import { longBook } from './load-fixture';

// P185 desktop: the tab map, step TM2 on the desktop. The same places as the phone's (p185-today-map.spec.ts), in the desktop's
// form: Pulse's three cards (widgets on Home since UI pass 3) and every verdict card open, Customise and More at the end of Home's toolbar row (its period came off on 21 Oct 2026), the Planner's tables
// kept, its toolbar one row with "Roll the trials", and Needs you's Add, Snoozed and Done in the tasks' stack. Made-up book.

test.describe('P185: Today on the desktop', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

  test('Needs you keeps Add at the head of the tasks, a task added there lands in it and the field keeps the focus', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), todo: { tasks: [{ id: 'T1', text: 'Ring the plater', due: '', note: '', link: null, createdAt: 1, doneAt: 2 }], snoozes: {} } } as unknown as SepState);
    await openNeeds(page);
    const tasks = page.locator('#homeNeeds [data-card="tasks"]');
    await expect(tasks.locator(':scope > *').first()).toHaveAttribute('data-tdy-add', '');
    await expect(tasks.locator('[data-card="done"] .inv-panel-count')).toHaveText('1');
    await page.locator('#todoNew').fill('Order rack hooks');
    await page.locator('[data-action="invTodoAdd"]').click();
    await expect(tasks.locator('[data-todo="mine"]').filter({ hasText: 'Order rack hooks' })).toHaveCount(1);
    await expect(page.locator('#todoNew')).toBeFocused();
  });

  test('Home: Why it moved, In one line and the pace are widgets drawn whole; no period, Customise and More at the row’s end; More holds the rest', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await openPulse(page);
    // Pulse's three cards are widgets on Home's board since UI pass 3 (U2): drawn whole, with no fold to open.
    for (const id of ['statsWhy', 'statsOverview', 'statsPace']) {
      await expect(page.locator('#' + id), id).toHaveClass(/inv-widget/);
      await expect(page.locator('#' + id + ' .inv-widget-body'), id).toBeVisible();
    }
    // Home reads this month (owner, 21 Oct 2026: the period chips came off): the toolbar is its own row under the masthead, the board's
    // tools at its end.
    const head = page.locator('#homeDash > [data-home-toolbar]');
    await expect(head).toHaveCount(1);
    await expect(head.locator('.inv-seg')).toHaveCount(0);
    const w = await head.evaluate(el => { const r = el.getBoundingClientRect(), a = (el.firstElementChild as HTMLElement).getBoundingClientRect(), b = (el.lastElementChild as HTMLElement).getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, first: a.left, last: b.right }; });
    expect(w.first).toBeGreaterThan(w.left + w.width / 2);
    expect(Math.abs(w.right - w.last)).toBeLessThanOrEqual(1);
    await toolbarMore(page);
    await expect(page.locator('[data-tb-more-dialog] [data-tb-pick]')).toHaveText(['Make today’s report', 'Make a report', 'Plant shut…', 'Open Stats', 'Reset Home']);
  });

  test('Stats’ verdict cards are open; the Planner keeps its tables and one toolbar row', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageStats');
    for (const tab of ['clients', 'cost', 'trends']) {
      await page.locator(`#statsToolbar [data-action="invStatsTab"][data-tab="${tab}"]`).click();
      expect(await page.locator('#statsToolbar > .inv-hero[data-verdict]').evaluate(el => (el as HTMLDetailsElement).open), tab).toBe(true);
    }
    await switchTab(page, 'pagePlanner');
    await expect(page.locator('[data-pl-toolbar] [data-action="invPlnRoll"]')).toHaveText('Roll the trials');
    const tops = await page.locator('[data-pl-toolbar]').evaluate(el => Array.from(el.children).map(c => { const r = (c as HTMLElement).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
    expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThan(8);
    await page.locator('#pagePlanner .inv-viewtab', { hasText: 'Moves' }).click();
    await expect(page.locator('#plnLines table')).toHaveCount(1);
    expect(await page.locator('#plnVerdict').evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  });

  test('the report on the page is laid out at the sheet’s width and zoomed to the room', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    const fit = await page.evaluate(() => {
      const sheet = document.getElementById('rptSheet')!, doc = sheet.querySelector('.inv-rpt-doc') as HTMLElement;
      return { right: doc.getBoundingClientRect().right, room: sheet.getBoundingClientRect().right, scroll: sheet.scrollWidth - sheet.clientWidth,
        laidOut: parseFloat(getComputedStyle(doc).width) };
    });
    // Laid out as the paper is, A4's 210 mm (793.7 px), never reflowed to the room; then zoomed to fit it.
    expect(Math.abs(fit.laidOut - 793.7)).toBeLessThanOrEqual(1);
    expect(fit.right).toBeLessThanOrEqual(fit.room + 1);
    expect(fit.scroll).toBeLessThanOrEqual(1);
  });
});
