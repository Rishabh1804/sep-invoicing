import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, todayIso, type SepState, openHome } from './fixtures';

// P121 (owner, 30 Sep 2026: "Home screen needs an overhaul with an option to select what widget to show on the home screen and
// where"): Home is widgets each person arranges, kept on this device and never in the book. It began as Pulse's presets (Owner,
// Floor, Money) and an edit mode; since UI pass 3 (U2) the board starts from the person's role's preset and is arranged in place
// (Customise: move, size, remove), the arrangement their own until Reset. The board itself is P223's; this holds the first ask.
// Made-up names.

const order = (p: Page) => p.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w as string));
const preset = (p: Page) => p.evaluate(() => (window as any).wdgPresetList('home', 'phone').map((x: string[]) => x[0]));
const stored = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_layout') || 'null'));
function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = { items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC', aliases: [], unit: 'L', active: true, createdAt: 1 }],
    entries: [{ id: 'SE0', itemId: 'N', kind: 'count', qty: 0, date: todayIso(), seq: 0, at: 1, source: 'manual', by: 'X' }], pastes: [] };
  return s as SepState;
}

test('Home starts from its role’s preset; an arrangement is the person’s own, stays on this device and is never in the book', async ({ page }) => {
  await loadAppWithState(page, book());
  await openHome(page);
  const start = await preset(page);
  expect(start.length).toBeGreaterThan(3);
  expect(await order(page)).toEqual(start);
  // The first widget moved to the end with the keys: the layout is the person's own from then on.
  await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
  await page.locator(`[data-wdg-handle="${start[0]}"]`).focus();
  await page.keyboard.press('End');
  await page.locator('[data-home-toolbar] [data-action="invWdgDone"]').click();
  const moved = start.slice(1).concat(start[0]);
  expect(await order(page)).toEqual(moved);
  expect((await stored(page)).people['-'].home.preset).toBe('custom');
  await page.reload();
  await page.waitForSelector('body.inv-booted');
  await openHome(page);
  expect(await order(page)).toEqual(moved);
  // Never in the book.
  expect(JSON.stringify(await readStoredState(page))).not.toMatch(/"preset"|"homeLayout"|sep_inv_layout/);
});

test('arranging removes a widget, sets one Large and adds one from the gallery; Reset asks, then puts the preset back', async ({ page }) => {
  await loadAppWithState(page, book());
  await openHome(page);
  const start = await preset(page);
  await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
  // Remove the second; set the first Large where it may be.
  await page.locator(`#homeBoard [data-action="invWdgRemove"][data-wid="${start[1]}"]`).click();
  await expect(page.locator(`#homeBoard [data-w="${start[1]}"]`)).toHaveCount(0);
  const large = await page.evaluate(ids => ids.find(id => (window as any).wdgDef(id).sizes.indexOf('l') >= 0), start);
  await page.locator(`#homeBoard [data-action="invWdgSize"][data-wid="${large}"][data-size="l"]`).click();
  await expect(page.locator(`#homeBoard .inv-widget[data-w="${large}"]`)).toHaveAttribute('data-size', 'l');
  // Stock days left is not in the Owner preset: from the gallery it goes to the end, and says the line running out.
  await page.locator('[data-home-toolbar] [data-action="invWdgGallery"]').click();
  await page.locator('.inv-gallery [data-action="invWdgGalleryAdd"][data-wid="stockdays"]').click();
  await page.locator('.inv-gallery [data-action="invWdgGalleryDone"]').first().click();
  await page.locator('[data-home-toolbar] [data-action="invWdgDone"]').click();
  expect((await order(page)).slice(-1)).toEqual(['stockdays']);
  await expect(page.locator('#homeBoard [data-w="stockdays"]')).toContainText('Nitric acid');
  const st = (await stored(page)).people['-'].home;
  expect(st.preset).toBe('custom');
  expect(st.phone.map((x: string[]) => x[0])).not.toContain(start[1]);
  expect(st.phone.find((x: string[]) => x[0] === large)[1]).toBe('l');
  // Reset asks, and Cancel keeps the arrangement; Reset puts the role's preset back.
  await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
  await page.locator('[data-home-toolbar] [data-action="invWdgReset"]').click();
  expect(await answerAsk(page, 'cancel')).toContain('back as the Owner layout');
  expect((await order(page)).slice(-1)).toEqual(['stockdays']);
  await page.locator('[data-home-toolbar] [data-action="invWdgReset"]').click();
  await answerAsk(page, 'ok');
  await page.locator('[data-home-toolbar] [data-action="invWdgDone"]').click();
  expect(await order(page)).toEqual(start);
});
