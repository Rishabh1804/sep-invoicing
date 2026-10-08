import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, openPulse, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P178 (desktop): the company's name and mark at the sidebar's top open Today → Pulse (owner, 8 Oct 2026: "Clicking on the
// company name (Soma Electro) or the icon on the top left of the screen should take us back to the pulse screen"); Needs you's
// cards are packed with no gap (§6.25), and Pulse's questions go three across, an opened one taking the row.

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

test('the name and the mark open Pulse from anywhere, as a step Back walks', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageIM');
  const brand = page.locator('.inv-side-brand');
  await expect(brand).toHaveAttribute('data-action', 'invGoPulse');
  await brand.click();
  await expect(page.locator('#homePulse')).toBeVisible();
  await expect.poll(() => where(page)).toEqual(['pageHome', 'pulse']);
  // From Needs you too: Today's own item opens Needs you, the brand Pulse.
  await page.locator('#wsTabs [data-v="needs"]').click();
  await expect(page.locator('#homeNeeds')).toBeVisible();
  await brand.click();
  await expect(page.locator('#homePulse')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#homeNeeds')).toBeVisible();
});

test('Needs you is packed: the tasks across the top, the other cards under them with no card over another, packed again as a card opens', async ({ page }) => {
  await loadAppWithState(page, sweepState());
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

test('Pulse: the questions three across, and one opened takes the row without leaving a hole', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openPulse(page);
  const grid = page.locator('[data-tdy-questions]');
  expect(await grid.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(3);
  const q = grid.locator(':scope > [data-tdy-q]').nth(1);
  await q.locator(':scope > summary').click();
  const [w, gw] = await q.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width]);
  expect(Math.abs(w - gw)).toBeLessThan(2);
  expect(await overlaps(page, '[data-tdy-questions]')).toEqual([]);
  // The widgets the owner arranged follow, packed as well.
  expect(await overlaps(page, '#homeWidgets')).toEqual([]);
});
