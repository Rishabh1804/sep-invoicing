import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P134 desktop: the sidebar of DIRECTION_B (owner, 1 Oct 2026): the brand, Add (the shell's one primary, key A), Search
// (Ctrl K), each workspace with its views under it, Settings at the foot. The workspace's tab row stands in the top bar,
// which names the workspace, then the page, its view and the record ("Office › Challans · Awaiting invoice"). P80 holds
// the list-and-pane screens to the room under that bar. Every name is made up; dates are from today.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const side = (p: Page) => p.locator('#invSidebar');

function state(): SepState {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    stock: { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] }],
      entries: [{ id: 'n1', itemId: 'N', kind: 'count', qty: 0, date: y, at: 1, seq: 1 }], pastes: [] },
  } as unknown as SepState;
}

test.describe('P134: workspaces on the desktop', () => {
  test('the sidebar: the brand, Add first, Search, each workspace with its views, Settings at the foot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    const has = async (id: string) => !!(await page.locator('#' + id).count());
    const hv = await g(page, `typeof homeViews === 'function'`);
    const want = ['Add', 'Search', 'Today', ...(hv ? ['Needs you', 'Pulse'] : []),
      'Office', ...(await has('pagePipeline') ? ['Pipeline'] : []), 'Challans', 'Invoices', 'Clients',
      'Floor', ...(await has('pageFloor') ? ['Day'] : []), 'People', 'Production', 'Stock', 'Power',
      'Money', 'Insights', 'Stats', 'Reports', 'History', 'Knowledge', 'Settings'];
    await expect(side(page).locator(':scope > button')).toHaveText(want.map(w => new RegExp('^' + w)));
    await expect(side(page).locator(':scope > :first-child')).toHaveClass(/inv-side-brand/);
    await expect(side(page).locator(':scope > button').last()).toHaveAttribute('data-action', 'invOpenSettings');
    // Add is the shell's one primary, not a view's (P76 knows it by data-shell-primary), with its key.
    const add = side(page).locator(':scope > button').first();
    await expect(add).toHaveClass(/inv-btn-primary/);
    await expect(add).toHaveAttribute('data-action', 'invAddOpen');
    await expect(add).toHaveAttribute('data-shell-primary', '');
    await expect(add.locator('.inv-kbd')).toHaveText('A');
    await expect(side(page).locator('[data-action="invSearchOpen"] .inv-kbd')).toHaveText('Ctrl K');
    // Items and Pay are views inside Clients and People now: one entry a page, and every view entry a door to its page.
    await expect(side(page).locator('[data-sub], [data-action="invSideGo"]')).toHaveCount(0);
    for (const t of await side(page).locator('.inv-side-item-sub').all()) await expect(t).toHaveAttribute('data-action', 'invSwitchTab');
    await expect(side(page).locator('.inv-side-item[data-ws="money"]')).toHaveAttribute('data-tab', 'pageFinance');
    // The red count, as on the phone's bar: the stock line out on Floor's head and on Today's, in the danger tone.
    await expect(side(page).locator('[data-ws="floor"] .inv-side-count')).toHaveText('1');
    await expect(side(page).locator('[data-ws="floor"] .inv-side-count')).toHaveClass(/inv-side-count-danger/);
    await expect(side(page).locator('[data-ws="today"] .inv-side-count')).toHaveText('1');
    await expect(side(page).locator('[data-ws="office"] .inv-side-count')).toHaveText('');
    // The whole sidebar, Settings included, fits a 1024 × 768 screen without scrolling.
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(await side(page).evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });

  test('the tab row stands in the top bar, which names the workspace, then the page, its view and the record', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await expect(page.locator('.inv-topbar > #wsTabs')).toBeVisible();
    await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Challans');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('#topbarCtx')).toHaveText('Challans · Awaiting invoice');
    // The bar keeps its height, so the list-and-pane screens keep the room under it (P80).
    expect(await page.locator('.inv-topbar').evaluate(el => el.getBoundingClientRect().height)).toBe(48);
    await expect(page.locator('.inv-navbar')).toBeHidden();
    // The tab row moves with the layout: down under the bar at phone width, back into it at desktop width.
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator('body > #wsTabs')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.inv-topbar > #wsTabs')).toBeVisible();
    // A page whose name is its workspace's says its view only (Money · Overview reads "Money › Overview").
    await switchTab(page, 'pageFinance');
    await expect(page.locator('#topbarTitle')).toHaveText('Money');
    await expect(page.locator('#topbarCtx')).toHaveText('Overview');
    await expect(page.locator('#wsTabs')).toBeHidden();
  });

  test('the sidebar marks the page; a page held without an entry marks its workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await expect(side(page).locator('[data-tab="pageIM"]')).toHaveAttribute('aria-current', 'page');
    await expect(side(page).locator('[data-ws="office"]')).not.toHaveClass(/inv-side-item-on/);
    await g(page, `switchTab('pageCreate')`);
    await expect(side(page).locator('[data-ws="office"]')).toHaveClass(/inv-side-item-on/);
    await expect(side(page).locator('[aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('#topbarCtx')).toHaveText('Create invoice');
  });

  test("search's entries (the bar's field, the sidebar's Search) and Add call their step", async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    const field = page.locator('.inv-topbar .inv-ws-search');
    await expect(field).toBeVisible();
    await expect(field.locator('.inv-kbd')).toHaveText('Ctrl K');
    await expect(page.locator('.inv-topbar .inv-topbar-btn[data-action="invSearchOpen"]')).toBeHidden();
    await g(page, `window.__calls = []; window.addOpen = function() { __calls.push('add'); }; window.searchOpen = function() { __calls.push('search'); }`);
    await field.click();
    await side(page).locator('[data-action="invSearchOpen"]').click();
    await side(page).locator('[data-action="invAddOpen"]').click();
    expect(await g(page, 'window.__calls')).toEqual(['search', 'search', 'add']);
    expect(errors).toEqual([]);
  });
});
