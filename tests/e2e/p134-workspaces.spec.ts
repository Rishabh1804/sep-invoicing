import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';

// P134: workspaces, the shell of DIRECTION_B (owner, 1 Oct 2026; docs/DIRECTION_B.md, step B2). The phone bar is
// Today · Office · Add · Floor · Money, with no More. A workspace is a layer over the pages that exist: every page keeps
// its id, its address and its own view tabs, and the workspace draws its views as a tab row above the page. The red count
// moved from More to the bar. Swiping stays inside the workspace. Add and search are other steps' (add.js, search.js):
// their buttons call them when they exist and do nothing when they do not. Every name is made up; dates are from today.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
const on = (p: Page) => g(p, `document.querySelector('.inv-page-active').id`) as Promise<string>;
const bar = (p: Page, ws: string) => p.locator(`.inv-navbar-item[data-ws="${ws}"]`);
const present = (p: Page, ids: string[]) => g(p, `${JSON.stringify(ids)}.filter(function(id){ return !!document.getElementById(id); })`) as Promise<string[]>;

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* A book with one stock line out: one red row, which the To-do sends to Stock (Floor). */
function state(): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    stock: {
      items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] },
        { id: 'H', name: 'HCL', key: 'HCL', unit: 'L', basis: 'draw', aliases: [] }],
      entries: [{ id: 'n1', itemId: 'N', kind: 'count', qty: 0, date: iso(-1), at: 1, seq: 1 },
        { id: 'h1', itemId: 'H', kind: 'count', qty: 400, date: iso(-5), at: 1, seq: 2 },
        { id: 'h2', itemId: 'H', kind: 'used', qty: 20, days: 5, from: iso(-5), date: iso(-1), at: 2, seq: 3 }],
      pastes: [],
    },
  } as unknown as SepState;
}
const swipe = (p: Page, from: number, to: number) => p.evaluate(([a, b]) => {
  const t = (x: number) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 300 });
  document.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], changedTouches: [t(a)] }));
  document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(b)] }));
}, [from, to]);

/* The map, restated (split/workspace.js WORKSPACES). */
const MAP: Record<string, string[]> = {
  today: ['pageHome', 'pageTodo'],
  office: ['pagePipeline', 'pageIM', 'pageRegister', 'pageClients', 'pageCreate'],
  floor: ['pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower'],
  money: ['pageFinance'],
  insights: ['pageStats', 'pageReports', 'pagePlanner', 'pageHistory', 'pageKnow'],
};

test.describe('P134: workspaces on the phone', () => {
  test('the bar is Today · Office · Add · Floor · Money · Insights with no More, drawn from the map', async ({ page }) => {
    await loadAppWithState(page, state());
    await expect(page.locator('.inv-navbar > .inv-navbar-item')).toHaveText([/^Today/, /^Office/, /^Add$/, /^Floor/, /^Money/, /^Insights/]);
    await expect(page.locator('.inv-navbar > .inv-navbar-item:nth-child(3)')).toHaveAttribute('data-action', 'invAddOpen');
    await expect(page.locator('.inv-navbar-add')).toHaveAttribute('data-shell-primary', '');
    expect(await g(page, `WORKSPACES.filter(function(w){ return w.bar; }).map(function(w){ return w.label; })`)).toEqual(['Today', 'Office', 'Floor', 'Money', 'Insights']);
    // More is gone: its button, its sheet and the code behind them.
    await expect(page.locator('.inv-navbar-more, #moreSheet, .inv-sheet, #moreBadge')).toHaveCount(0);
    expect(await g(page, `[typeof openMoreSheet, typeof closeMoreSheet, typeof MORE_TABS, typeof sideGo]`)).toEqual(['undefined', 'undefined', 'undefined', 'undefined']);
    // Every item, Add included, is a whole touch target.
    for (const h of await page.locator('.inv-navbar > .inv-navbar-item').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('each workspace item opens its workspace and is on for every page it holds, Insights too', async ({ page }) => {
    await loadAppWithState(page, state());
    for (const [ws, ids] of Object.entries(MAP)) {
      for (const id of await present(page, ids)) {
        await g(page, `switchTab(${JSON.stringify(id)})`);
        await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
        await expect(bar(page, ws)).toHaveClass(/inv-navbar-item-on/);
        await expect(page.locator('.inv-navbar-item-on')).toHaveCount(1);
        expect(await g(page, `wsOf(${JSON.stringify(id)})`)).toBe(ws);
      }
    }
    // The items open their workspace from another.
    await bar(page, 'office').click();
    expect(MAP.office).toContain(await on(page));
    await bar(page, 'floor').click();
    expect(MAP.floor).toContain(await on(page));
    await bar(page, 'money').click();
    expect(await on(page)).toBe('pageFinance');
    await bar(page, 'today').click();
    expect(MAP.today).toContain(await on(page));
  });

  test('the tab row lists the views present, under the top bar; the top bar names the workspace', async ({ page }) => {
    await loadAppWithState(page, state());
    const row = page.locator('#wsTabs');
    const labels = async (ids: string[], names: string[]) => { const ps = await present(page, ids); return names.filter((_, i) => ps.includes(ids[i])); };
    await switchTab(page, 'pageIM');
    await expect(row).toHaveAttribute('role', 'tablist');
    await expect(row.locator('.inv-viewtab[role="tab"]')).toHaveText(await labels(['pagePipeline', 'pageIM', 'pageRegister', 'pageClients'], ['Pipeline', 'Challans', 'Invoices', 'Clients']));
    await expect(row.locator('[aria-selected="true"]')).toHaveText('Challans');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    // Each tab is a door: the action and the page, so a jump, a link and the fixtures land on the same place.
    for (const t of await row.locator('.inv-viewtab').all()) await expect(t).toHaveAttribute('data-action', 'invSwitchTab');
    // It sits on the top bar's foot and stays with it.
    const [barBottom, rowTop] = await g(page, `[document.querySelector('.inv-topbar').getBoundingClientRect().bottom, document.getElementById('wsTabs').getBoundingClientRect().top]`) as number[];
    expect(Math.abs(barBottom - rowTop)).toBeLessThanOrEqual(1);
    await row.locator('[data-tab="pageRegister"]').click();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
    await expect(row.locator('[aria-selected="true"]')).toHaveText('Invoices');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');

    await switchTab(page, 'pageStock');
    await expect(row.locator('.inv-viewtab')).toHaveText(await labels(['pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower'], ['Day', 'People', 'Production', 'Stock', 'Power']));
    await expect(page.locator('#topbarTitle')).toHaveText('Floor');
    await switchTab(page, 'pageStats');
    await expect(row.locator('.inv-viewtab')).toHaveText(['Stats', 'Reports', 'Planner', 'History', 'Knowledge']);
    await expect(page.locator('#topbarTitle')).toHaveText('Insights');
    // Money is one view: no row, and its own six tabs are the only one.
    await switchTab(page, 'pageFinance');
    await expect(row).toBeHidden();
    await expect(page.locator('#topbarTitle')).toHaveText('Money');
    // Today's two views are pageHome's own, drawn once pageHome declares them (the Today step).
    await switchTab(page, 'pageHome');
    if (await g(page, `typeof homeViews === 'function'`)) await expect(row.locator('.inv-viewtab')).toHaveText(['Needs you', 'Pulse']);
    else await expect(row).toBeHidden();
    // A page held without a tab lights its workspace, shows its row with nothing pressed, and names itself.
    await g(page, `switchTab('pageCreate')`);
    await expect(bar(page, 'office')).toHaveClass(/inv-navbar-item-on/);
    await expect(row).toBeVisible();
    await expect(row.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(page.locator('#topbarTitle')).toHaveText('Create invoice');
  });

  test('a red stock line counts on Floor and on Today; More carried it before', async ({ page }) => {
    await loadAppWithState(page, state());
    await expect(page.locator('[data-ws-count="floor"]')).toHaveText('1');
    await expect(page.locator('[data-ws-count="today"]')).toHaveText('1');
    for (const ws of ['office', 'money']) await expect(page.locator(`.inv-navbar [data-ws-count="${ws}"]`)).toBeHidden();
    await expect(page.locator('[data-ws-count="floor"]')).toHaveClass(/inv-navbar-count/);
    // A count follows the book: a count put right clears it.
    await g(page, `S.stock.entries.push({ id: 'n2', itemId: 'N', kind: 'count', qty: 200, date: '${iso(0)}', at: Date.now(), seq: 9 }); updateStockBadge()`);
    await expect(page.locator('.inv-navbar [data-ws-count="floor"]')).toBeHidden();
    await expect(page.locator('.inv-navbar [data-ws-count="today"]')).toBeHidden();
  });

  test('the address is the page\'s own, and a reload opens it in its workspace', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await page.locator('#pageStock .inv-viewtab[data-view="list"]').click();
    await expect.poll(() => where(page)).toEqual(['pageStock', 'list']);
    await page.reload();
    await waitForBoot(page);
    expect(where(page)).toEqual(['pageStock', 'list']);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    await expect(bar(page, 'floor')).toHaveClass(/inv-navbar-item-on/);
    await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Stock');
    await expect(page.locator('#topbarTitle')).toHaveText('Floor');
    // An address typed or bookmarked does the same.
    await page.goto('/?tab=pageRegister');
    await waitForBoot(page);
    await expect(bar(page, 'office')).toHaveClass(/inv-navbar-item-on/);
    await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Invoices');
  });

  test('back walks across workspaces, each step lighting its own', async ({ page }) => {
    await loadAppWithState(page, state());
    await bar(page, 'office').click();
    const office = await on(page);
    await bar(page, 'floor').click();
    const floor = await on(page);
    await bar(page, 'money').click();
    await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
    await page.goBack();
    await expect(page.locator(`#${floor}`)).toHaveClass(/inv-page-active/);
    await expect(bar(page, 'floor')).toHaveClass(/inv-navbar-item-on/);
    await page.goBack();
    await expect(page.locator(`#${office}`)).toHaveClass(/inv-page-active/);
    await expect(bar(page, 'office')).toHaveClass(/inv-navbar-item-on/);
    await page.goBack();
    await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
    await expect(bar(page, 'today')).toHaveClass(/inv-navbar-item-on/);
    await page.goForward();
    await expect(bar(page, 'office')).toHaveClass(/inv-navbar-item-on/);
  });

  test("a workspace item opens the view last open in it; on the open workspace, its first view at the top", async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await page.locator('#wsTabs [data-tab="pageClients"]').click();
    await bar(page, 'floor').click();
    await bar(page, 'office').click();
    await expect(page.locator('#pageClients')).toHaveClass(/inv-page-active/);
    expect(JSON.parse(await g(page, `sessionStorage.getItem('sep_inv_ws_last')`) as string).office.tab).toBe('pageClients');
    await g(page, `window.scrollTo(0, 400)`);
    await bar(page, 'office').click();
    const first = await g(page, `wsViewsPresent('office')[0].tab`) as string;
    await expect(page.locator(`#${first}`)).toHaveClass(/inv-page-active/);
    expect(await g(page, 'window.scrollY')).toBe(0);
  });

  test('swiping moves within the workspace and stops at its ends', async ({ page }) => {
    await loadAppWithState(page, state());
    for (const ws of ['office', 'insights']) {
      const views: string[] = await g(page, `wsViewsPresent('${ws}').map(function(v){ return v.tab; })`) as string[];
      await g(page, `switchTab('${views[0]}')`);
      await swipe(page, 100, 300);   // before the first: nothing
      await page.waitForTimeout(150);
      await expect(page.locator(`#${views[0]}`)).toHaveClass(/inv-page-active/);
      for (const id of views.slice(1)) {
        await swipe(page, 300, 100);
        await expect(page.locator(`#${id}`)).toHaveClass(/inv-page-active/);
      }
      await swipe(page, 300, 100);   // past the last: nothing, never into the next workspace
      await page.waitForTimeout(150);
      await expect(page.locator(`#${views[views.length - 1]}`)).toHaveClass(/inv-page-active/);
    }
    // A page held without a tab (Create) is in no order: a swipe there moves nothing.
    await g(page, `switchTab('pageCreate')`);
    await swipe(page, 300, 100);
    await page.waitForTimeout(150);
    await expect(page.locator('#pageCreate')).toHaveClass(/inv-page-active/);
  });

  // Add and search are built in now (add.js, search.js); the bar's two doors call them.
  test('Add calls addOpen; search calls searchOpen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await loadAppWithState(page, state());
    await g(page, `window.__calls = []; window.addOpen = function() { __calls.push('add'); }; window.searchOpen = function() { __calls.push('search'); }`);
    await page.locator('.inv-navbar-add').click();
    await page.locator('.inv-topbar [data-action="invSearchOpen"]:visible').click();
    expect(await g(page, 'window.__calls')).toEqual(['add', 'search']);
    expect(errors).toEqual([]);
  });

  test('the top bar: search, Knowledge, then Settings; two tab rows leave the page starting by 150px', async ({ page }) => {
    await loadAppWithState(page, state());
    const btns = page.locator('.inv-topbar > button:visible');
    await expect(btns.nth(-3)).toHaveAttribute('data-action', 'invSearchOpen');
    await expect(btns.nth(-2)).toHaveAttribute('data-action', 'invKbHelp');   // the knowledge base (P154)
    await expect(btns.nth(-1)).toHaveAttribute('data-action', 'invOpenSettings');
    for (const h of await btns.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
    // Office → Challans and Floor → Production: the workspace's row, then the page's own; what follows starts by 150px.
    for (const [id, own] of [['pageIM', '#imToolbar > .inv-viewtabs'], ['pageProduction', '#productionContent > .inv-viewtabs']]) {
      await switchTab(page, id);
      await g(page, 'window.scrollTo(0, 0)');
      await expect(page.locator('#wsTabs')).toBeVisible();
      await expect(page.locator(own)).toBeVisible();
      const m = await g(page, `(function() {
        var own = document.querySelector('${own}'), ws = document.getElementById('wsTabs');
        return { start: own.nextElementSibling.getBoundingClientRect().top, ownTop: own.getBoundingClientRect().top,
          wsBottom: ws.getBoundingClientRect().bottom, tabs: Array.from(ws.querySelectorAll('.inv-viewtab')).map(function(t) { return t.getBoundingClientRect().height; }) };
      })()`) as { start: number; ownTop: number; wsBottom: number; tabs: number[] };
      expect(m.start, id).toBeLessThanOrEqual(150);
      expect(m.ownTop, id).toBeGreaterThanOrEqual(m.wsBottom - 1);
      for (const h of m.tabs) expect(h).toBeGreaterThanOrEqual(44);
    }
  });
});
