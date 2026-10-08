import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P134 desktop: the rail (owner, 8 Oct 2026: "in the desktop view we have many tabs that are actually tabs that exist under a
// different tab but it is there on the sidebar … user will not understand the hierarchy"). The phone's bar stood on its side:
// the mark (it opens Pulse), Add (the shell's one primary, key A), the workspaces, Settings at the foot, and never a view of a
// workspace. Its views are the tab row under the top bar, as on the phone; the top bar names the workspace, then the page, its
// view and the record ("Office › Challans · Awaiting invoice"). P80 holds the list-and-pane screens to the room under the bar
// and the row. Every name is made up; dates are from today.

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
  test('the rail: the mark, Add, the workspaces, Settings at the foot, and no view of a workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    const doors = side(page).locator(':scope > button');
    // The mark is a door (owner, 8 Oct 2026: it opens Pulse, P178), so it heads the buttons; Add follows it.
    await expect(doors).toHaveText(['', /^Add$/, /^Today/, /^Office/, /^Floor/, /^Money/, /^Settings$/]);
    await expect(doors.first()).toHaveClass(/inv-side-brand/);
    await expect(doors.first()).toHaveAttribute('data-action', 'invGoPulse');
    await expect(doors.first()).toHaveAttribute('aria-label', 'Soma Electro: open Pulse');
    await expect(doors.last()).toHaveAttribute('data-action', 'invOpenSettings');
    // Add is the shell's one primary, not a view's (P76 knows it by data-shell-primary), with its key.
    const add = doors.nth(1);
    await expect(add).toHaveAttribute('data-action', 'invAddOpen');
    await expect(add).toHaveAttribute('data-shell-primary', '');
    await expect(add).toHaveAttribute('aria-keyshortcuts', 'A');
    // Each workspace is one door; none of its views is listed (they are its tab row), and search is the top bar's field.
    for (const w of ['today', 'office', 'floor', 'money']) await expect(side(page).locator(`[data-ws="${w}"]`)).toHaveAttribute('data-action', 'invWsGo');
    await expect(side(page).locator('[data-tab], [data-v], [data-sub], [data-action="invSideGo"], [data-action="invSearchOpen"]')).toHaveCount(0);
    // The doors are the bar's: every mark one size, and the rail as wide as the page's offset.
    const marks = await side(page).locator('.inv-navbar-mark').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return r.width + 'x' + r.height; }));
    expect(new Set(marks).size).toBe(1);
    const [railW, offset] = await g(page, `[document.getElementById('invSidebar').getBoundingClientRect().width, parseFloat(getComputedStyle(document.body).marginLeft)]`) as number[];
    expect(railW).toBe(offset);
    expect(railW).toBeLessThanOrEqual(96);
    // The red count, as on the phone's bar: the stock line out on Floor's door and on Today's; none on Office's.
    await expect(side(page).locator('[data-ws="floor"] [data-ws-count]')).toHaveText('1');
    await expect(side(page).locator('[data-ws="floor"] [data-ws-count]')).toBeVisible();
    await expect(side(page).locator('[data-ws="today"] [data-ws-count]')).toHaveText('1');
    await expect(side(page).locator('[data-ws="office"] [data-ws-count]')).toBeHidden();
    // The whole rail, Settings included, fits a 1024 × 768 screen without scrolling.
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(await side(page).evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });

  test('the tab row stands under the top bar, which names the workspace, then the page, its view and the record', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await expect(page.locator('body > #wsTabs')).toBeVisible();
    await expect(page.locator('.inv-topbar #wsTabs')).toHaveCount(0);
    await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Challans');
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('#topbarCtx')).toHaveText('Challans · Awaiting invoice');
    // Office's work, then its review after a divider.
    await expect(page.locator('#wsTabs .inv-viewtab')).toHaveText(['Pipeline', 'Challans', 'Invoices', 'Clients', 'Stats', 'Reports', 'Planner', 'History', 'Knowledge']);
    expect(await g(page, `document.querySelector('#wsTabs .inv-viewtab-sep').nextElementSibling.dataset.tab`)).toBe('pageStats');
    // The bar keeps its height and the row sits on its foot, one tab tall, so the list-and-pane screens keep the room under
    // both (P80).
    const m = await g(page, `(function() { var b = document.querySelector('.inv-topbar').getBoundingClientRect(), r = document.getElementById('wsTabs').getBoundingClientRect(),
      t = document.querySelector('#wsTabs .inv-viewtab').getBoundingClientRect(); return [b.height, r.top - b.bottom, r.height - t.height]; })()`) as number[];
    expect(m[0]).toBe(48);
    expect(Math.abs(m[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(m[2])).toBeLessThanOrEqual(1);
    await expect(page.locator('.inv-navbar')).toBeHidden();
    // The row stays under the bar across a layout switch.
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator('body > #wsTabs')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('body > #wsTabs')).toBeVisible();
    // A page whose name is its workspace's says its view only (Money · Overview reads "Money › Overview").
    await switchTab(page, 'pageFinance');
    await expect(page.locator('#topbarTitle')).toHaveText('Money');
    await expect(page.locator('#topbarCtx')).toHaveText('Overview');
    await expect(page.locator('#wsTabs')).toBeHidden();
  });

  test('the rail marks the workspace on screen, whichever of its views is open, a page it holds without a tab included', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, state());
    const marked = () => side(page).locator('[aria-current]');
    for (const [tab, ws] of [['pageIM', 'office'], ['pageStats', 'office'], ['pageStock', 'floor'], ['pageFinance', 'money']]) {
      await switchTab(page, tab);
      await expect(marked()).toHaveCount(1);
      await expect(side(page).locator(`[data-ws="${ws}"]`)).toHaveAttribute('aria-current', 'true');
      await expect(side(page).locator(`[data-ws="${ws}"]`)).toHaveClass(/inv-side-item-on/);
    }
    await g(page, `switchTab('pageCreate')`);
    await expect(side(page).locator('[data-ws="office"]')).toHaveClass(/inv-side-item-on/);
    await expect(page.locator('#topbarTitle')).toHaveText('Office');
    await expect(page.locator('#topbarCtx')).toHaveText('Create invoice');
  });

  test("search's field in the top bar and the rail's Add call their step", async ({ page }) => {
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
    await side(page).locator('[data-action="invAddOpen"]').click();
    expect(await g(page, 'window.__calls')).toEqual(['search', 'add']);
    expect(errors).toEqual([]);
  });
});
