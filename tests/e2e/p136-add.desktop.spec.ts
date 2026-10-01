import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P136 on the desktop: the key A opens Add (never from a field, never over a layer), the sheet is centred, the box takes a
// paste at once and Ctrl+Enter reads it, and By hand lays its ten forms out five across.

function dmy(offset: number) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
async function load(page: Page) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}
const sheet = (page: Page) => page.locator('[data-add-sheet]');

test.describe('P136 desktop: Add on a keyboard', () => {
  test('A opens Add centred, with the box ready for a paste; By hand is five across', async ({ page }) => {
    await load(page);
    await page.keyboard.press('a');
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator('#addPasteText')).toBeFocused();
    // The key was the door, not a letter typed into the box it opened.
    await expect(page.locator('#addPasteText')).toHaveValue('');
    await page.waitForTimeout(300);   // past the dialog's scale-in
    const box = (await sheet(page).boundingBox())!, vp = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(2);
    const rows = await page.locator('[data-action="invAddHand"]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(rows).size).toBe(2);
    expect(rows.filter(t => t === rows[0])).toHaveLength(5);
    // Over the sheet (a layer) the key is a letter in the box, never a second sheet.
    await page.keyboard.press('a');
    await expect(page.locator('#addPasteText')).toHaveValue('a');
    await expect(sheet(page)).toHaveCount(1);
  });

  test('A does nothing from a field or over another layer', async ({ page }) => {
    await load(page);
    await switchTab(page, 'pageClients');
    await page.locator('#clientSearch').click();
    await page.keyboard.press('a');
    await expect(page.locator('#clientSearch')).toHaveValue('a');
    await expect(sheet(page)).toHaveCount(0);
    // Settings open: a layer.
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('#settingsScrim')).toHaveCount(1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('a');
    await expect(sheet(page)).toHaveCount(0);
    await page.locator('[data-action="invCloseSettings"]').first().click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('A');
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
  });

  test('Ctrl+Enter in the box reads it: a stock message opens the stock check', async ({ page }) => {
    await load(page);
    await page.keyboard.press('a');
    await page.locator('#addPasteText').fill(`${dmy(-2)}/ camical use\n1) NITRIC 10-2=8 L`);
    await page.keyboard.press('Control+Enter');
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeVisible();
  });
});
