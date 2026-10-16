import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, withWidgets, switchTab } from './fixtures';
import { sweepState } from './sweep-fixture';

// P223 on the desktop (UI pass 3, U2; docs/UI_PASS_3.md §7b, §7e, §8a): the board's columns come from its own width (12 from
// 60rem, 6 from 36rem), a Small spanning 3, a Medium 6 of 12 (the row of 6), a Large the row; a mouse drags a widget at once;
// the rail's mark opens Home; the desktop's layout is its own, the phone's left as it was.

const ids = (page: Page) => page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w));
const spans = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length, gw = grid.getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0, col = (gw - gap * (cols - 1)) / cols;
  return { cols, span: Object.fromEntries(Array.from(grid.querySelectorAll('.inv-widget')).map(el => [(el as HTMLElement).dataset.w,
    Math.round((el.getBoundingClientRect().width + gap) / (col + gap))])) };
});

test.describe('P223 Home and its board (desktop)', () => {
  test('12 columns at 1280 px and 6 at 1024: a Small spans 3, a Medium 6, a Large the row', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'l']]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, sweepState());
    let m = await spans(page);
    expect(m.cols).toBe(12);
    expect(m.span).toEqual({ mtd: 3, 'q-money': 3, pace: 6, recent: 12 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(async () => (await spans(page)).cols).toBe(6);
    m = await spans(page);
    expect(m.span).toEqual({ mtd: 3, 'q-money': 3, pace: 6, recent: 6 });
  });

  test('a mouse drags a widget at once; the desktop’s order is its own and the phone’s stays as it was', async ({ page }) => {
    await withWidgets(page, [['mtd', 's'], ['q-money', 's'], ['pace', 'm'], ['recent', 'm']]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loadAppWithState(page, sweepState());
    await page.locator('[data-home-toolbar] [data-action="invWdgArrange"]').click();
    // Arranging focuses the first handle on a keyboard's screen.
    await expect(page.locator('[data-wdg-handle="mtd"]')).toBeFocused();
    const h = (await page.locator('[data-wdg-handle="mtd"]').boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(1);
    // Over Recent invoices' far quarter (its right and its lower half, so "after" whether the card is split across or down): the
    // lifted card's centre is the pointer's, less where the card was taken.
    const at = await page.evaluate(() => {
      const r = document.querySelector('#homeBoard [data-w="recent"]')!.getBoundingClientRect();
      const c = document.querySelector('#homeBoard [data-w="mtd"]')!.getBoundingClientRect();
      return { dx: (r.left + r.width * 0.75) - (c.left + c.width / 2), dy: (r.top + r.height * 0.75) - (c.top + Math.min(c.height, 160) / 2) };
    });
    await page.mouse.move(h.x + h.width / 2 + at.dx, h.y + h.height / 2 + at.dy, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(0);
    await expect.poll(() => ids(page)).toEqual(['q-money', 'pace', 'recent', 'mtd']);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_layout')!).people['-'].home);
    expect(st.desk.map((x: string[]) => x[0])).toEqual(['q-money', 'pace', 'recent', 'mtd']);
    expect(st.phone.map((x: string[]) => x[0])).toEqual(['mtd', 'q-money', 'pace', 'recent']);
    // Escape during a drag puts the widget back where it was.
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    const h2 = (await page.locator('[data-wdg-handle="q-money"]').boundingBox())!;
    await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
    await page.mouse.down();
    await page.mouse.move(h2.x + 400, h2.y + 300, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.inv-widget-lifted')).toHaveCount(0);
    expect(await ids(page)).toEqual(['q-money', 'pace', 'recent', 'mtd']);
  });

  test('the rail’s mark opens Home’s dashboard, from anywhere, as a step', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadAppWithState(page, sweepState());
    await switchTab(page, 'pageRegister');
    await page.locator('[data-action="invGoHome"]').first().click();
    await expect(page.locator('#homeDash [data-home-day]')).toBeVisible();
    await expect(page.locator('#homeDash')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#pageRegister')).toHaveClass(/inv-page-active/);
  });
});
