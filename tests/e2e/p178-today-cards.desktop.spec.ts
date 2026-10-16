import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, openPulse, switchTab, openNeeds, openHome, withWidgets } from './fixtures';
import { sweepState } from './sweep-fixture';

// P178 (desktop): the company's name and mark at the rail's top open Home (Today → Pulse until UI pass 3; owner, 8 Oct 2026:
// "Clicking on the company name (Soma Electro) or the icon on the top left of the screen should take us back to the pulse
// screen"); Needs you's cards are packed with no gap (§6.25), and Home's board packs its widgets, a Large one taking the row.

const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };
/* Pairs of a grid's children whose boxes overlap. */
const overlaps = (p: Page, sel: string) => p.locator(sel).evaluate(grid => {
  const r = Array.prototype.map.call(grid.children, (c: Element) => c.getBoundingClientRect()) as DOMRect[];
  const bad: string[] = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(i + '×' + j);
  }
  return bad;
});

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); });

test('the name and the mark open Home from anywhere, as a step Back walks', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageIM');
  const brand = page.locator('.inv-side-brand');
  await expect(brand).toHaveAttribute('data-action', 'invGoHome');
  await brand.click();
  await expect(page.locator('#homeDash')).toBeVisible();
  await expect.poll(() => where(page)).toEqual(['pageHome', 'home']);
  // From Needs you too: the brand opens Home's board.
  await page.locator('#wsTabs [data-v="needs"]').click();
  await expect(page.locator('#homeNeeds')).toBeVisible();
  await brand.click();
  await expect(page.locator('#homeDash')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#homeNeeds')).toBeVisible();
});

test('Needs you is packed: the tasks across the top, the other cards under them with no card over another, packed again as a card opens', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openNeeds(page);
  const grid = page.locator('#homeNeeds [data-tdy-grid]');
  await expect(grid).toHaveClass(/inv-masonry-on/);
  const tasks = grid.locator(':scope > [data-card="tasks"]');
  const [tw, gw] = await tasks.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width]);
  expect(Math.abs(tw - gw)).toBeLessThan(2);
  expect(await overlaps(page, '#homeNeeds [data-tdy-grid]')).toEqual([]);
  // A card opened or shut grows or shrinks: the grid packs again.
  const recent = grid.locator(':scope > [data-card="recent"]');
  if (await recent.count()) {
    await recent.locator(':scope > summary').click();
    await expect.poll(() => overlaps(page, '#homeNeeds [data-tdy-grid]')).toEqual([]);
    await recent.locator(':scope > summary').click();
  }
  const later = page.locator('[data-tdy-group="later"], [data-tdy-group="week"]').first();
  if (await later.count()) {
    await later.locator(':scope > summary').click();
    await expect.poll(() => overlaps(page, '#homeNeeds [data-tdy-grid]')).toEqual([]);
  }
});

test('Home: the board packs its widgets in twelve columns, Small four across and a Large taking the row, no widget over another', async ({ page }) => {
  // Pulse's questions went three across until UI pass 3 (U2); on the board a widget's size decides its span (§7b).
  await withWidgets(page, [['q-smooth', 's'], ['q-money', 's'], ['q-clients', 's'], ['q-plant', 's'], ['q-changed', 'l'], ['dofirst', 'm'], ['why', 'm']]);
  await loadAppWithState(page, sweepState());
  await openHome(page);
  const grid = page.locator('#homeBoard .inv-wgrid');
  expect(await grid.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(12);
  const tops = await grid.locator(':scope > [data-size="s"]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const q = grid.locator(':scope > [data-w="q-changed"]');
  const [w, gw] = await q.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width]);
  expect(Math.abs(w - gw)).toBeLessThan(2);
  expect(await overlaps(page, '#homeBoard .inv-wgrid')).toEqual([]);
});
