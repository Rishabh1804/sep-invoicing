import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, openPulse as openToday, switchTab, openNeeds } from './fixtures';
import { adviceState, LYRA_TEL, ORION } from './p133-what-to-do.fixture';

// P133 on the desktop: a question opens across its row, so a move's sentence must keep room to read beside its buttons, or
// take the line above them; a task's moves sit in the centred dialog; a call is a real link drawn as a button. Made-up names.
// The questions are Today → Pulse's since the tab map (TM2b); the To-do is Needs you's.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

/** Home with Pulse's questions on its board, read for this month (Home has no period to pick since 21 Oct 2026, owner). */
async function openPulse(page: Page) {
  await openToday(page);
  await expect(page.locator('[data-home-toolbar] [data-action="invStatsPeriod"]')).toHaveCount(0);
  expect(await g(page, `wdgPeriod('home')`)).toBe('mtd');
}
async function openQ(page: Page, key: string) {
  // A question is a widget on Home since UI pass 3 (U2): at Large (openPulse lays them out so) it holds its answer and its moves
  // since U2R; its story and every move with Add to my list are the dialog its head opens (openQDialog).
  const q = page.locator(`[data-tdy-q="${key}"]`);
  await expect(q.locator('[data-tdy-ans]')).toHaveCount(1);
  return q;
}
async function openQDialog(page: Page, key: string) {
  await page.locator(`#homeBoard [data-tdy-q="${key}"] [data-action="invWdgGo"]`).click();
  const d = page.locator(`[data-tdy-q-open="${key}"]`);
  await expect(d.locator('[data-tdy-story]')).toHaveCount(1);
  return d;
}

test('a move keeps its sentence readable in its card, its call is a link drawn as a button, and the dialog lists moves', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loadAppWithState(page, adviceState());
  await openPulse(page);
  for (const k of ['smooth', 'money', 'clients', 'plant', 'cash']) await openQ(page, k);
  await expect(page.locator('[data-tdy-q="clients"] [data-adv-move="reprice:1"]')).toContainText(`Ask ${ORION} for`);

  // Every visible move: inside its question (or Do first), its sentence at least 16rem wide or alone on its line above its action.
  // A move is a card in a well at Large, a row at Medium (U2R §24d), or a row under an insight of What changed?. A row of what
  // stands in the way names its move too (`inv-brief-row`, the canvas's Briefing) and opens it: it is the move's line, not the move.
  const rows = await page.locator('#homeDash [data-adv-move]:not(.inv-brief-row):visible').evaluateAll(els => els.map(el => {
    const card = el.closest('[data-tdy-q], [data-card="first"]')!.getBoundingClientRect(), r = el.getBoundingClientRect();
    const main = el.querySelector('.inv-brief-move-main, .inv-deck-body, .inv-row-main')!.getBoundingClientRect();
    const endEl = el.querySelector(':scope > .inv-btn, :scope > a.inv-btn, .inv-deck-foot, .inv-row-end'), end = endEl ? endEl.getBoundingClientRect() : null;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { key: (el as HTMLElement).dataset.advMove, inside: r.left >= card.left - 1 && r.right <= card.right + 1 && (!end || end.right <= card.right + 1),
      readable: main.width >= 16 * rem - 1 || !end || end.top >= main.bottom - 1 };
  }));
  expect(rows.length).toBeGreaterThan(5);
  for (const r of rows) expect(r, String(r.key)).toMatchObject({ inside: true, readable: true });

  // The call: a tel: link with the button's look, no underline.
  const call = page.locator('[data-tdy-q="cash"] [data-adv-move="owed:3"] a[href^="tel:"]');
  await expect(call).toHaveAttribute('href', LYRA_TEL);
  expect(await call.evaluate(a => getComputedStyle(a).textDecorationLine)).toBe('none');

  // A task's dialog, centred, lists its moves above what clears it; its one primary is still its own button.
  await openNeeds(page);
  await page.locator('#wsTabs [data-v="needs"]').click();
  const btn = page.locator('#homeNeeds [data-action="invTodoOpenApp"][data-key="stock:PA"]');
  await btn.evaluate(b => { const d = b.closest('details'); if (d) (d as HTMLDetailsElement).open = true; });
  await btn.click();
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
  await openToday(page);
  await openQ(page, 'smooth');
  const smooth = await openQDialog(page, 'smooth');
  await expect(smooth.locator('[data-adv-move="stock:PA"] [data-adv-listed]')).toBeVisible();
  await expect(smooth.locator('[data-adv-move="stock:PA"] [data-action="invAdvTask"]')).toHaveCount(0);
});
