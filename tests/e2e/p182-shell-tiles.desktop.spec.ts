import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P182 desktop (owner, 8 Oct 2026: "in the desktop view we have many tabs that are actually tabs that exist under a different
// tab but it is there on the sidebar which I feel is the wrong design choice as user will not understand the hierarchy"). Three
// levels, the same as the phone's: a workspace is a door on the rail; its views are the row under the top bar; a page's own
// views are the row under that. The rail's doors are the bar's.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);

test('three levels: the rail, the workspace row under the bar, the page row under that', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageStats');
  const m = await g(page, `(function() {
    var bar = document.querySelector('.inv-topbar').getBoundingClientRect(), ws = document.getElementById('wsTabs').getBoundingClientRect();
    var own = document.querySelector('#pageStats .inv-viewtabs').getBoundingClientRect(), rail = document.getElementById('invSidebar').getBoundingClientRect();
    return { wsTop: ws.top - bar.bottom, ownTop: own.top - ws.bottom, wsLeft: ws.left - rail.right,
      railDoors: document.querySelectorAll('#invSidebar .inv-side-item[data-ws] .inv-navbar-mark').length,
      onMark: getComputedStyle(document.querySelector('#invSidebar .inv-side-item-on .inv-navbar-mark')).backgroundColor };
  })()`) as { wsTop: number; ownTop: number; wsLeft: number; railDoors: number; onMark: string };
  expect(Math.abs(m.wsTop)).toBeLessThanOrEqual(1);
  expect(m.ownTop).toBeGreaterThanOrEqual(-1);
  expect(Math.abs(m.wsLeft)).toBeLessThanOrEqual(1);
  expect(m.railDoors).toBe(4);
  expect(m.onMark).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Stats');
  // Stats is one of Today's Insights since the tab map (9 Oct 2026).
  await expect(page.locator('#invSidebar [data-ws="today"]')).toHaveAttribute('aria-current', 'true');
  // The page row is the page's own (Stats' five tabs), never the workspace's.
  await expect(page.locator('#pageStats .inv-viewtabs [aria-selected="true"]')).toHaveText('Overview');
});

test("the rail's Add and the bar's are one door: a filled pill in the accent, its key A", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, sweepState());
  const add = page.locator('#invSidebar .inv-navbar-add');
  await expect(add).toHaveAttribute('data-action', 'invAddOpen');
  await expect(add).toHaveAttribute('aria-keyshortcuts', 'A');
  const [fill, accent] = await g(page, `(function() {
    var probe = document.createElement('i'); probe.style.color = 'var(--accent)'; document.body.appendChild(probe);
    var a = getComputedStyle(probe).color; probe.remove();
    return [getComputedStyle(document.querySelector('#invSidebar .inv-navbar-add .inv-navbar-mark')).backgroundColor, a];
  })()`) as string[];
  expect(fill).toBe(accent);
});
