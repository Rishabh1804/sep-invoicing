import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, SepState } from './fixtures';

/*
 * Creating a missing part without leaving the line being typed.
 *
 * A part not in the Items Master used to end data entry: the dropdown vanished
 * on zero matches, and the only way forward was to leave for the Items tab, add
 * the part, and come back to a form that no longer held what had been typed.
 *
 * The add row is offered even when there ARE matches, because a new gauge of an
 * existing clamp matches the part number and is still a different part. That
 * made the keyboard contract the thing to protect: one real suggestion plus a
 * permanently-present add row is two options, and the documented lone-match
 * Enter shortcut would have stopped working.
 */

function itemsState(items: Array<Record<string, unknown>>): SepState {
  const s = emptyState();
  s.items = items;
  s.clients = [{
    id: 1, name: 'TEST CLIENT KG', billingMode: 'weight', gstType: 'intra', gstin: '', address: '',
    // The invoice form's client search filters on isActive, so an inactive
    // fixture client is unselectable and the form never gets past step one.
    isActive: true,
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2020-04-01' }], itemRates: [],
  } as never];
  return s;
}

const CLAMP = {
  id: 1, partNumber: 'CLAMP 165X83', desc: 'CLAMP 165X83 (NT)', gauge: '40X6',
  hsn: '998873', unit: 'KG', rate: 13, stdWeightKg: null,
};

/**
 * Start a challan and type into its first part field.
 *
 * A freshly opened challan form focuses the client search on a 100ms timer —
 * deliberately, so nothing above can steal it back. Typing into the part field
 * inside that window is something no human does on a form that has only just
 * appeared, but a test gets there in single-digit milliseconds, and the focus
 * landing mid-interaction dismissed the suggestion list and lost the entry.
 * Waiting for that focus first makes the sequence the one a person performs.
 */
async function typeChallanPart(page: Page, text: string) {
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').click();
  await expect(page.locator('#imChallanClientSearch')).toBeFocused();
  const part = page.locator('[data-action="invEditChallanPart"][data-idx="0"]');
  await part.waitFor();
  await part.fill(text);
  await expect(part).toHaveValue(text);
  return part;
}

/** Start an invoice line and type into its part field. */
async function typeInvoicePart(page: Page, text: string) {
  await switchTab(page, 'pageCreate');
  // The client is chosen through a search box, not a list — nothing is
  // selectable until something is typed.
  await page.locator('#invClientSearch').fill('TEST CLIENT');
  await page.locator('[data-action="invSelectClient"]').first().click();
  await page.locator('[data-action="invAddLineItem"]').click();
  const part = page.locator('[data-action="invEditLinePart"][data-idx="0"]');
  await part.waitFor();
  await part.fill(text);
  return part;
}

async function storedItems(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state') || '{}').items);
}

test('P20: a part with no match offers to be created instead of the list vanishing', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeChallanPart(page, 'BRACKET 990');

  const add = page.locator('.inv-ac-add');
  await expect(add).toBeVisible();
  await expect(add).toContainText('Add “BRACKET 990”');
});

test('P20: creating it inline fills the line and never leaves the form', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeChallanPart(page, 'BRACKET 990');
  await page.locator('.inv-ac-add').click();

  // Prefilled from what was typed — confirming, not retyping.
  await expect(page.locator('#itemEditPN')).toHaveValue('BRACKET 990');
  await page.locator('#itemEditGauge').fill('25X4');
  await page.locator('[data-action="invSaveItem"]').click();

  // The overlay closes back to the challan, not to the Items tab.
  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
  await expect(page.locator('#pageIM.inv-page-active')).toBeVisible();

  const items = await storedItems(page);
  expect(items).toHaveLength(2);
  expect(items[1].partNumber).toBe('BRACKET 990');
  expect(items[1].gauge).toBe('25X4');

  // And the line now carries it, gauge folded into the description the way
  // every other part-selection path does it.
  const desc = page.locator('[data-action="invEditChallanPart"][data-idx="0"]');
  await expect(desc).toHaveValue('BRACKET 990 (25X4)');
});

test('P20: the same affordance exists on the invoice line', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeInvoicePart(page, 'WASHER 12');
  await page.locator('.inv-ac-add').click();

  await expect(page.locator('#itemEditPN')).toHaveValue('WASHER 12');
  await page.locator('[data-action="invSaveItem"]').click();

  await expect(page.locator('.inv-overlay-scrim')).toHaveCount(0);
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await expect(page.locator('[data-action="invEditLinePart"][data-idx="0"]')).toHaveValue('WASHER 12');
});

test('P20: it is offered alongside matches, because a new gauge is a new part', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeChallanPart(page, 'CLAMP 165X83');

  // The existing 40X6 row matches, and the same number in 35X6 is still a part
  // the registry does not have.
  await expect(page.locator('.inv-autocomplete-item[data-part-id="1"]')).toBeVisible();
  await expect(page.locator('.inv-ac-add')).toBeVisible();
});

test('P20: a lone real match still commits on Enter with the add row present', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  const part = await typeChallanPart(page, 'CLAMP 165X83');

  // Two options are in the list, but only one of them is a suggestion. Enter
  // must still take it without an arrow press first — the documented shortcut.
  await part.press('Enter');

  await expect(page.locator('[data-action="invEditChallanPart"][data-idx="0"]'))
    .toHaveValue('CLAMP 165X83 (NT) (40X6)');
  await expect(page.locator('#itemEditPN')).toHaveCount(0);
});

test('P20: an unaimed Enter on a brand-new part moves on rather than opening a dialog', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  const part = await typeChallanPart(page, 'BRACKET 990');
  await part.press('Enter');

  // Typing a part and pressing Enter means "on to the quantity". Creating it
  // is a deliberate act — arrow onto the row, or click it.
  await expect(page.locator('#itemEditPN')).toHaveCount(0);
  const items = await storedItems(page);
  expect(items).toHaveLength(1);
});

test('P20: the add row is reachable by keyboard', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  const part = await typeChallanPart(page, 'BRACKET 990');

  await part.press('ArrowDown');
  await expect(page.locator('.inv-ac-add.inv-ac-active')).toBeVisible();
  await part.press('Enter');

  await expect(page.locator('#itemEditPN')).toHaveValue('BRACKET 990');
});

test('P20: one character is not enough to offer creating a part', async ({ page }) => {
  await loadAppWithState(page, itemsState([]));
  await typeChallanPart(page, 'B');
  await expect(page.locator('.inv-ac-add')).toHaveCount(0);
});

test('P20: an abandoned inline add cannot redirect a later ordinary one', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeChallanPart(page, 'BRACKET 990');
  await page.locator('.inv-ac-add').click();
  // Walk away from it. (The overlay carries both an X and a Cancel; either
  // does, so name the one in the header.)
  await page.locator('.inv-overlay-close').click();

  // Now add an item the ordinary way, from the Items tab.
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
  await page.locator('[data-action="invAddItem"]').first().click();
  await page.locator('#itemEditPN').fill('PLAIN ITEM');
  await page.locator('[data-action="invSaveItem"]').click();

  // It must stay put, not jump into the challan line left behind earlier.
  await expect(page.locator('#pageClients.inv-page-active')).toBeVisible();
  const items = await storedItems(page);
  expect(items.map((i: { partNumber: string }) => i.partNumber)).toContain('PLAIN ITEM');
});

test('P20: a duplicate part and gauge is refused, and the line is left alone', async ({ page }) => {
  await loadAppWithState(page, itemsState([CLAMP]));
  await typeChallanPart(page, 'CLAMP 165X83');
  await page.locator('.inv-ac-add').click();
  await page.locator('#itemEditGauge').fill('40X6');
  await page.locator('[data-action="invSaveItem"]').click();

  // Identity is part number plus gauge, and this pair already exists.
  await expect(page.locator('.inv-toast')).toContainText('Already exists');
  const items = await storedItems(page);
  expect(items).toHaveLength(1);
});
