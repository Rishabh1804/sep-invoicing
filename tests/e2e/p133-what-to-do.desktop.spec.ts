import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, openStatsTab, switchTab } from './fixtures';
import { adviceState, LYRA_TEL, ORION } from './p133-what-to-do.fixture';

// P133 on the desktop: the questions sit two to a row, so a move's sentence must keep room to read beside its buttons, or
// take the line above them; a task's moves sit in the centred dialog; a call is a real link drawn as a button. Made-up names.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

test('a move keeps its sentence readable in a half-width card, its call is a link drawn as a button, and the dialog lists moves', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadAppWithState(page, adviceState());
  await openStatsTab(page, 'overview');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
  await expect(page.locator('[data-story="clients"] [data-adv-move="reprice:1"]')).toContainText(`Ask ${ORION} for`);

  // Every visible move: inside its card, its sentence at least 16rem wide or alone on its line above the buttons.
  const rows = await page.locator('#statsContent [data-adv-move]:visible').evaluateAll(els => els.map(el => {
    const card = el.closest('[data-story]')!.getBoundingClientRect(), r = el.getBoundingClientRect();
    const main = el.querySelector('.inv-row-main')!.getBoundingClientRect(), end = el.querySelector('.inv-row-actions')!.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { key: (el as HTMLElement).dataset.advMove, inside: r.left >= card.left - 1 && r.right <= card.right + 1 && end.right <= card.right + 1,
      readable: main.width >= 16 * rem - 1 || end.top >= main.bottom - 1 };
  }));
  expect(rows.length).toBeGreaterThan(5);
  for (const r of rows) expect(r, String(r.key)).toMatchObject({ inside: true, readable: true });

  // The call: a tel: link with the button's look, no underline.
  const call = page.locator('[data-story="cash"] [data-adv-move="owed:3"] a[href^="tel:"]');
  await expect(call).toHaveAttribute('href', LYRA_TEL);
  expect(await call.evaluate(a => getComputedStyle(a).textDecorationLine)).toBe('none');

  // A task's dialog, centred, lists its moves above what clears it; its one primary is still its own button.
  await switchTab(page, 'pageTodo');
  await page.locator('#todoContent [data-action="invTodoOpenApp"][data-key="stock:PA"]').click();
  const dlg = page.locator('.inv-scrim-dialog .inv-dialog');
  // One decision, one key: the task's move is the Pulse's stock move (QA5-5; it was "order:PA" here and "stock:PA" there).
  await expect(dlg.locator('[data-adv-moves] [data-adv-move="stock:PA"]')).toContainText('Put Pickling acid on the order');
  const box = await dlg.boundingBox();
  expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(4);
  await expect(dlg.locator('.inv-btn-primary')).toHaveCount(1);
  // Add to my list from the dialog marks the move there and on the Pulse.
  await dlg.locator('[data-adv-move="stock:PA"] [data-action="invAdvTask"]').click();
  await expect(dlg.locator('[data-adv-move="stock:PA"] [data-adv-listed]')).toBeVisible();
  expect(await g(page, `todoData().tasks.filter(function(t) { return t.advKey === 'stock:PA' && !t.doneAt; }).length`)).toBe(1);
  await page.keyboard.press('Escape');
  await openStatsTab(page, 'overview');
  await expect(page.locator('[data-story="smooth"] [data-adv-move="stock:PA"] [data-adv-listed]')).toBeVisible();
  await expect(page.locator('[data-story="smooth"] [data-adv-move="stock:PA"] [data-action="invAdvTask"]')).toHaveCount(0);
});
