import { test, expect } from '@playwright/test';
import { challanByKeyboard, createByKeyboard, focusInSight, focusedKey, slipped } from './p275-long-form-focus.fixture';

/*
 * P275: a long form typed by keyboard keeps the field being typed in on screen (owner, 17 Nov 2026: "in the new challan tab,
 * when 3 or more lines are entered without using a mouse, focus slips and the page does not orient").
 *
 * Focus went to the right field every time; the browser's own scroll on focus only asks whether the field is inside the window,
 * and the bars drawn over the page (the form's sticky action bar, the phone's bottom bar, the top bar) are inside it. From the
 * second or third line on, the field typed into sat under the action bar or the bottom bar, so the next key went into a field
 * nobody could see. The fix is one reveal for every keyboard path (state.js kbdReveal): the Enter chain, a form redrawn under
 * the keyboard (kbdRestoreFocus), Tab, and the on-screen keyboard rising. The phone layout here; the desk's is the .desktop twin.
 * Made-up data only (HR-10).
 */

test.describe('P275: a long form typed by keyboard keeps its field in sight (phone)', () => {
  test('challan entry, eight lines by Enter: every field landed on is on screen and under no bar', async ({ page }) => {
    const seen = await challanByKeyboard(page, 8);
    expect(seen.length).toBeGreaterThan(40);
    expect(slipped(seen)).toEqual([]);
  });

  test('Create invoice, six lines by Enter: every field landed on is on screen and under no bar', async ({ page }) => {
    const seen = await createByKeyboard(page, 6);
    expect(seen.length).toBeGreaterThan(30);
    expect(slipped(seen)).toEqual([]);
  });

  test('Alt+N on a long challan: the new line\'s part is brought into sight', async ({ page }) => {
    await challanByKeyboard(page, 3);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Alt+n');
      await expect.poll(() => focusedKey(page)).toBe('part-' + (4 + i));
      expect(await focusInSight(page)).toBe('ok');
    }
  });

  test('Tab down a long challan: each field reached is clear of the bars', async ({ page }) => {
    await challanByKeyboard(page, 4);
    await page.locator('#imAddForm [data-k="challanNo"]').focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const inForm = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#imAddForm .inv-lines'));
      if (inForm) seen.push((await focusedKey(page)) + ': ' + await focusInSight(page));
    }
    expect(seen.length).toBeGreaterThan(10);
    expect(slipped(seen)).toEqual([]);
  });

  test('the window shrinking under a field (the on-screen keyboard rising) brings the field back into sight', async ({ page }) => {
    await challanByKeyboard(page, 3);
    await page.keyboard.press('Shift+Tab');
    await page.locator('#imAddForm [data-k="qty-3"]').focus();
    expect(await focusInSight(page)).toBe('ok');
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });
    await expect.poll(() => focusInSight(page)).toBe('ok');
  });
});
