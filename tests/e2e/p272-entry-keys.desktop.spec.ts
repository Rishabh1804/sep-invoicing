import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, readStoredState } from './fixtures';
import { longBook } from './load-fixture';

// P272: entering several at a sitting by the keyboard (owner: bugs "mostly based on navigation when entering data"). After a save,
// or in a dialog filled cell after cell, the cursor is where the next entry is typed, and Enter goes on. Made-up book (HR-10).

test('Stock by hand: after Save the cursor is back on the first quantity, and the list just saved stays in sight', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  const first = page.locator('#stockContent [data-flow] [data-stock-qty]').first();
  await first.fill('5');
  await page.locator('.inv-actionbar .inv-btn-primary').first().click();
  await expect(page.locator('#stockDayEntries')).toBeVisible();
  const y = await page.evaluate(() => window.scrollY);
  await expect(page.locator('#stockContent [data-flow] [data-stock-qty]').first()).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  // The next entry is typed straight in.
  await page.keyboard.type('7');
  await expect(page.locator('#stockContent [data-flow] [data-stock-qty]').first()).toHaveValue('7');
});

test('People → Register by hand: a cell opens on As written, and Enter keeps it and goes on to the next day', async ({ page }) => {
  await loadAppWithState(page, longBook());
  await switchTab(page, 'pageStaff');
  await page.evaluate(() => (0, eval)("attSetView('register'); aregStart();"));
  await page.locator('[data-action="invAregCell"]').first().click();
  const dlg = page.locator('[data-areg-cell]'), raw = dlg.locator('[data-areg-raw]');
  await expect(raw).toBeFocused();
  const day1 = await dlg.locator('#aregCellT').textContent();
  await page.keyboard.type('P');
  await page.keyboard.press('Enter');
  // The next working day of the same column, the cursor waiting in it.
  await expect(dlg.locator('#aregCellT')).not.toHaveText(day1!);
  await expect(raw).toBeFocused();
  await page.keyboard.type('A');
  await page.keyboard.press('Enter');
  const cells = await page.evaluate(() => (0, eval)(
    "(function(){ var mo = aregMonthOf(aregMonthShown()); return mo.days.filter(function(d){ return d.kind === 'work'; }).slice(0, 3).map(function(d){ return d.cells[0].raw || ''; }); })()"));
  expect(cells).toEqual(['P', 'A', '']);
  await expect(raw).toBeFocused();
  // Escape leaves the dialog as before.
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
});
