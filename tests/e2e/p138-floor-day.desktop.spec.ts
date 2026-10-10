import { test, expect } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';
import { floorBook, openFloor, card, hero, g, T, D2 } from './p138-floor-day.fixture';

// P138 on the desktop (Direction B, step 5): Floor's Overview (the tab map, TM4a): the heroes above, the four line cards two
// across, the worst first; the day named in the top bar, a card opening Production → Lines and Back returning to the day.
// Made-up names and parts.

test('the heroes sit above the four cards, and the cards stand two across, the worst first', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  const box = async (l: ReturnType<typeof card>) => (await l.boundingBox())!;
  // Pickling is judged by its heads (met); the plating lines' efficiency is not judged here (no units on record), after it.
  const [pk, a1, a2, br] = await Promise.all(['pickling', 'vat-a1', 'vat-a2', 'barrel'].map(l => box(card(page, l))));
  const heroes = (await page.locator('#flrHeroes').boundingBox())!;
  // The four heroes in a row, above every card.
  const tops = await Promise.all(['people', 'prod', 'stock', 'power'].map(async k => (await hero(page, k).boundingBox())!.y));
  expect(new Set(tops.map(Math.round)).size).toBeLessThanOrEqual(2);
  expect(heroes.y + heroes.height).toBeLessThanOrEqual(Math.min(pk.y, a1.y) + 1);
  // Pickling beside VAT A1; VAT A2 beside Barrel, under them.
  expect(Math.abs(pk.y - a1.y)).toBeLessThan(2);
  expect(pk.x + pk.width).toBeLessThanOrEqual(a1.x + 1);
  expect(Math.abs(a2.y - br.y)).toBeLessThan(2);
  expect(a2.y).toBeGreaterThanOrEqual(pk.y + pk.height - 1);
  expect(Math.abs(a2.x - pk.x)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('the top bar names the day; a card opens Production → Lines on it, and Back comes back to it', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  await expect(page.locator('.inv-topbar')).toContainText('Today');
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await expect(page.locator('#flrDate')).toHaveValue(D2);
  await expect(page.locator('.inv-topbar')).toContainText(await g(page, `attDayName('${D2}') + ' ' + formatDate('${D2}')`) as string);
  await card(page, 'barrel').locator('[data-action="invFlrLine"]').click();
  await expect(page.locator('#pageProduction.inv-page-active')).toBeVisible();
  await expect(page.locator('#productionContent [data-action="invProdLine"][data-line="barrel"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#productionContent .inv-stepper-title')).toContainText(await g(page, `formatDate('${D2}')`) as string);
  await page.goBack();
  await expect(page.locator('#pageFloor.inv-page-active')).toBeVisible();
  await expect(page.locator('#flrDate')).toHaveValue(D2);
  await expect(page).toHaveURL(new RegExp('tab=pageFloor&d=' + D2));
});

test('the page passes the sweep on the desktop, light and dark, on a full day and an empty one', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await loadAppWithState(page, floorBook());
  const stops: Stop[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openFloor(page);
    if (await page.locator('[data-action="invFlrToday"]').isEnabled()) await page.locator('[data-action="invFlrToday"]').click();
    await expect(page.locator('#flrDate')).toHaveValue(T);
    stops.push(await sweep(page, `pageFloor today (${scheme})`));
    await page.locator('#flrDate').fill(D2);
    await page.locator('#flrDate').dispatchEvent('change');
    await expect(page.locator('#flrDate')).toHaveValue(D2);
    stops.push(await sweep(page, `pageFloor two days back (${scheme})`));
  }
  expect(problems(stops)).toEqual([]);
  expect(errors).toEqual([]);
});
