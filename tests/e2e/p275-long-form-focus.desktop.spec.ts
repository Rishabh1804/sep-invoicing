import { test, expect } from '@playwright/test';
import { challanByKeyboard, createByKeyboard, focusInSight, focusedKey, slipped } from './p275-long-form-focus.fixture';

/*
 * P275 on the desk: the challan form's action bar is held at the window's foot there too, and from the second line on the line
 * typed into sat under it (phone twin: p275-long-form-focus.spec.ts). Made-up data only (HR-10).
 */

test.describe('P275: a long form typed by keyboard keeps its field in sight (desk)', () => {
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
    await challanByKeyboard(page, 5);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Alt+n');
      await expect.poll(() => focusedKey(page)).toBe('part-' + (6 + i));
      expect(await focusInSight(page)).toBe('ok');
    }
  });
});
