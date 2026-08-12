import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, SepState } from './fixtures';

/*
 * Keyboard path through the IM challan form.
 *
 * Everything here used to require a pointer. The two suggestion lists rendered
 * with no way in but a click, and — the quieter half of the problem — the form
 * re-renders by replacing innerHTML, so adding a line or changing a unit
 * dropped focus to <body> and ended the keyboard path mid-entry.
 */

/** The challan form's client search filters on `isActive`, which emptyState omits. */
function keyboardState(): SepState {
  const state = emptyState();
  state.clients = state.clients.map((c) => ({ ...c, isActive: true }));
  // Two parts sharing a prefix, so arrowing past the first match is meaningful
  // rather than the lone-match shortcut doing the work.
  state.items = [
    { id: 101, partNumber: 'CLAMP 45X86', desc: 'BOX CLAMP', gauge: '30X6', hsn: '998873', unit: 'KG', rate: 13, stdWeightKg: 0.5 },
    { id: 102, partNumber: 'CLAMP 45X90', desc: 'BOX CLAMP WIDE', gauge: '32X6', hsn: '998873', unit: 'KG', rate: 14, stdWeightKg: 0.6 },
  ];
  return state;
}

async function openChallanForm(page: Page) {
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').waitFor();
}

test.describe('IM challan form — keyboard navigation', () => {
  test('client is selectable with arrow keys and Enter', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);

    await page.locator('#imChallanClientSearch').fill('TEST');
    await expect(page.locator('#imChallanClientResults .inv-search-item')).toHaveCount(1);

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#imChallanClientResults .inv-ac-active')).toHaveCount(1);

    await page.keyboard.press('Enter');

    // Client committed, and focus moved on to the next thing that gets typed
    // rather than being dropped by the re-render.
    await expect(page.locator('.inv-selected-client')).toContainText('TEST CLIENT KG');
    await expect(page.locator('#imChallanNo')).toBeFocused();
  });

  test('a lone suggestion commits on Enter without arrowing first', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);

    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await expect(page.locator('.inv-selected-client')).toContainText('TEST CLIENT KG');
  });

  test('part autocomplete is navigable and hands focus to the quantity', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.locator('#imPart0').fill('CLAMP');
    await expect(page.locator('#imPartAC0 .inv-autocomplete-item')).toHaveCount(2);

    // Second match, reached by keyboard only.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#imPartAC0 .inv-autocomplete-item').nth(1)).toHaveClass(/inv-ac-active/);

    await page.keyboard.press('Enter');

    // The gauge is folded into the line description: two clamp rows can share a
    // part number and differ only by gauge, so the line text has to carry it.
    await expect(page.locator('#imPart0')).toHaveValue('BOX CLAMP WIDE (32X6)');
    await expect(page.locator('#imQty0')).toBeFocused();
  });

  test('arrow keys wrap at the ends of the list', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.locator('#imPart0').fill('CLAMP');
    // Up from nothing selected lands on the last option.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#imPartAC0 .inv-autocomplete-item').nth(1)).toHaveClass(/inv-ac-active/);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#imPartAC0 .inv-autocomplete-item').nth(0)).toHaveClass(/inv-ac-active/);
  });

  test('Escape closes the suggestion list and leaves the typed text alone', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.locator('#imPart0').fill('CLAMP');
    await expect(page.locator('#imPartAC0')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#imPartAC0')).toBeHidden();
    await expect(page.locator('#imPart0')).toHaveValue('CLAMP');
  });

  test('Alt+N adds a line item and focuses it', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await expect(page.locator('.inv-line-item')).toHaveCount(1);
    await page.locator('#imChallanNo').focus();
    await page.keyboard.press('Alt+n');

    await expect(page.locator('.inv-line-item')).toHaveCount(2);
    await expect(page.locator('#imPart1')).toBeFocused();
  });

  test('Enter from the last field steps onto Add Line Item rather than dead-ending', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    // Rate is the last editable field of a KG line; amount is readonly there.
    await page.locator('#imRate0').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-k="addline"]')).toBeFocused();

    // And activating it from the keyboard makes the next line.
    await page.keyboard.press('Enter');
    await expect(page.locator('.inv-line-item')).toHaveCount(2);
  });

  test('changing the unit keeps focus in the form', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    // A keyboard user is on the select when they change it, which is the case
    // that used to drop focus to <body> when the form re-rendered.
    await page.locator('#imUnit0').focus();
    await page.locator('#imUnit0').selectOption('NOS');

    await expect(page.locator('#imUnit0')).toBeFocused();
    await expect(page.locator('#imUnit0')).toHaveValue('NOS');
  });

  test('a re-render never drops focus out of the form', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.locator('#imQty0').focus();
    await page.locator('#imQty0').fill('12.5');
    await page.locator('#imUnit0').focus();
    await page.locator('#imUnit0').selectOption('NOS');

    const inForm = await page.evaluate(() => {
      const area = document.getElementById('imAddForm');
      return !!(area && document.activeElement && area.contains(document.activeElement));
    });
    expect(inForm).toBe(true);
  });

  test('Ctrl+Enter saves the challan', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.locator('#imChallanNo').fill('KB-1');
    await page.locator('#imPart0').fill('CLAMP 45X86');
    await page.keyboard.press('Escape');
    await page.locator('#imQty0').fill('100');
    await page.keyboard.press('Control+Enter');

    await expect(page.locator('.inv-toast')).toContainText('Challan saved');
    // seed.js fills an empty incomingMaterial with 50 demo challans, so the
    // assertion is on the row this test created, not on the total.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('sep_invoicing_state');
      const all = raw ? JSON.parse(raw).incomingMaterial : [];
      return all.filter((im: { challanNo: string }) => im.challanNo === 'KB-1');
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].items[0].qty).toBe(100);
  });

  test('removing a line keeps focus on a surviving line', async ({ page }) => {
    await loadAppWithState(page, keyboardState());
    await openChallanForm(page);
    await page.locator('#imChallanClientSearch').fill('TEST');
    await page.keyboard.press('Enter');

    await page.keyboard.press('Alt+n');
    await expect(page.locator('.inv-line-item')).toHaveCount(2);

    await page.locator('[data-k="remove-0"]').click();
    await expect(page.locator('.inv-line-item')).toHaveCount(1);
    await expect(page.locator('#imPart0')).toBeFocused();
  });
});
