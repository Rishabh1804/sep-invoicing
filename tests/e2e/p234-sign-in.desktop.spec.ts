import { test, expect } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';
import { guardBook } from './p140-guard.fixture';
import { FOUR, withFour, dots } from './p234-sign-in.fixture';

// P234 on the desktop (docs/UI_PASS_3.md §15a): a panel on the left (the company and its line, the date and the clock, Tata's
// week; never a figure of the book) and the card on the right (Welcome back, Pick your ID, the IDs as rows, four wells taking typed
// digits, Sign in, Forgot your PIN? with its hint), its foot saying the computer locks after a while away. No keypad. Made-up names.

test.describe('P234: sign-in (desktop)', () => {
  test('the panel and the card; the IDs as rows; digits typed into four wells, Enter at four; no keypad', async ({ page }) => {
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const lock = page.locator('#guardRoot');
    const panel = lock.locator('[data-grd-panel]');
    await expect(panel.locator('.inv-guard-co')).toHaveText('SOMA ELECTRO PRODUCTS');
    await expect(panel.locator('[data-grd-clock]')).toHaveText(/^\d{1,2}:\d{2} (AM|PM)$/);
    await expect(panel.locator('[data-grd-date]')).toHaveText(/^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day, \d{1,2} [A-Z][a-z]+$/);
    await expect(panel.locator('[data-mkt-week] .inv-mkt-day')).toHaveCount(7);
    await expect(lock.locator('.inv-guard-title')).toHaveText('Welcome back');
    await expect(lock.locator('.inv-guard-sub').first()).toHaveText('Pick your ID, then type your PIN.');
    await expect(lock.locator('.inv-guard-card [role="radio"]')).toHaveCount(3);
    await expect(lock.locator('[role="radio"][aria-checked="true"]')).toContainText('Asha Rao');
    await expect(lock.locator('[data-grd-keypad]')).toHaveCount(0);
    await expect(lock.locator('#grdPin')).toHaveAttribute('inputmode', 'numeric');
    await expect(lock.locator('.inv-guard-forgot')).toContainText('Forgot your PIN?use your recovery code');
    await expect(lock.locator('[data-grd-foot]')).toHaveText('This computer locks after a while away');
    // Nothing of the book's figures.
    expect(await lock.innerText()).not.toMatch(/₹|SEP\/TEST|BRKT|Nitric/);
    // Digits typed (a letter is no digit), Backspace, and Enter at four.
    const go = lock.locator('[data-action="invGuardUnlock"]');
    await lock.locator('#grdPin').focus();
    await page.keyboard.type('4a8');
    expect(await dots(page)).toBe(2);
    await expect(go).toBeDisabled();
    await page.keyboard.press('Backspace');
    expect(await dots(page)).toBe(1);
    await page.keyboard.type('829');
    expect(await dots(page)).toBe(4);
    await expect(go).toBeEnabled();
    await page.keyboard.press('Enter');
    await expect(lock).toHaveCount(0);
    // Another ID's hint: the owner can reset it.
    await page.evaluate(() => (window as any).grdLockAll('switch'));
    await lock.locator('[data-id="U-off"]').click();
    await expect(lock.locator('.inv-guard-forgot')).toContainText('the owner can reset it');
    await lock.locator('#grdPin').fill(FOUR.office);
    await go.click();
    await expect(lock).toHaveCount(0);
  });

  test('the lock on the desktop is drawn from the components, and the phone’s drawing becomes the desktop’s when the window widens', async ({ page }) => {
    test.setTimeout(120_000);
    await loadAppWithState(page, guardBook());
    await withFour(page, 'U-own');
    const stops: Stop[] = [];
    const s1 = await sweep(page, 'lock, desktop'); s1.blank = false; stops.push(s1);
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const s2 = await sweep(page, 'lock, desktop, dark'); s2.blank = false; stops.push(s2);
    expect(problems(stops)).toEqual([]);
    // Narrowed to a phone and back: the keypad comes and goes with the layout.
    await page.setViewportSize({ width: 400, height: 860 });
    await expect(page.locator('#guardRoot [data-grd-keypad]')).toHaveCount(1, { timeout: 5000 });
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#guardRoot [data-grd-panel]')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('#guardRoot [data-grd-keypad]')).toHaveCount(0);
  });
});
