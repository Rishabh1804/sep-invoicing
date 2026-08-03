import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, type SepState } from './fixtures';

// P7 assertion: the startup migration collapses redundant Items Master rows
// without touching rows that only *look* redundant.
//
// The negative cases matter more than the positive one. Rows sharing a part
// number but differing in rate or unit encode real product differences — for
// the clamp lines that is the steel gauge (35X6 vs 40X6), and SSSMehta
// challans bill the 40X6 rate. A dedupe that collapsed those would silently
// change what gets billed to the largest client in the book.

type Item = {
  id: number; partNumber: string; desc: string; gauge?: string;
  hsn: string; unit: string; rate: number; stdWeightKg: number | null;
};

const item = (id: number, partNumber: string, desc: string, unit = 'KG', rate = 0): Item =>
  ({ id, partNumber, desc, hsn: '998873', unit, rate, stdWeightKg: null });

function stateWithItems(items: Item[]): SepState {
  const state = emptyState();
  state.items = items;
  return state;
}

async function itemsAfterLoad(page: import('@playwright/test').Page): Promise<Item[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('sep_invoicing_state') || '{}';
    return (JSON.parse(raw) as { items: Item[] }).items;
  }) as Promise<Item[]>;
}

test.describe('P7: Items Master redundant-row migration', () => {

  test('collapses rows identical in every field', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, 'NAIL', 'NAIL'),
      item(2, 'NAIL', 'NAIL'),
      item(3, 'WIRE 2X12', 'WIRE 2X12'),
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items.filter((i) => i.partNumber === 'NAIL')).toHaveLength(1);
    expect(items).toHaveLength(2);
  });

  test('keeps the row whose description carries information', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, '5024 4030 7901N', '5024 4030 7901N'),      // desc is just the part number
      item(2, '5024 4030 7901N', 'SHAFT - 1800054866'),   // desc is real
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(1);
    expect(items[0].desc).toBe('SHAFT - 1800054866');
  });

  test('NEGATIVE: same part number, different rate — both rows survive', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, 'CLAMP 133X83 (NT)', '35X6', 'NOS', 3.67),
      item(2, 'CLAMP 133X83 (NT)', '40X6', 'NOS', 4.24),
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(2);
    // Both gauges keep their own rate — this is the case that must never merge.
    expect(items.map((i) => i.rate).sort()).toEqual([3.67, 4.24]);
    // The gauge migration has lifted "35X6"/"40X6" out of desc into its field.
    expect(items.map((i) => i.gauge).sort()).toEqual(['35X6', '40X6']);
    expect(items.map((i) => i.desc)).toEqual(['', '']);
  });

  // Rates stay under 25 here on purpose: the pre-existing `_rateCleanup1`
  // migration deletes any item over that threshold ("Belrise trading
  // remnants"), which would mask what this test is actually asserting.
  test('NEGATIVE: same part number, different unit — both rows survive', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, '5032 4030 3501', '5032 4030 3501', 'KG', 0),
      item(2, '5032 4030 3501', 'HEX NUT - 1800053463', 'NOS', 12.5),
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.unit).sort()).toEqual(['KG', 'NOS']);
  });

  test('NEGATIVE: conflicting real descriptions — both rows survive', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, 'BRACKET X', 'LEFT HAND'),
      item(2, 'BRACKET X', 'RIGHT HAND'),
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(2);
  });

  test('lifts a bare gauge out of the description into its own field', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, 'CLAMP 133X83 (NT)', '40X6', 'NOS', 4.24),
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items[0].gauge).toBe('40X6');
    expect(items[0].desc).toBe('');
  });

  test('does NOT treat a description that repeats the part number as a gauge', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, '82X81', '82X81'),          // part number describes itself
      item(2, '150X68X3', '150X68X3'),    // three dimensions — a size, not a gauge
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items.find((i) => i.partNumber === '82X81')?.gauge).toBeFalsy();
    expect(items.find((i) => i.partNumber === '150X68X3')?.gauge).toBeFalsy();
  });

  test('reassigns duplicate item ids so every row stays reachable', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      { ...item(4586, 'CLAMP 45X86(BOX)', '25X6', 'NOS', 1.53) },
      { ...item(4586, 'BOX CLAMP 45X86', 'BOX CLAMP 45X86', 'NOS', 0) },
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
    // Both rows survive with their own identity.
    expect(items.map((i) => i.partNumber).sort()).toEqual(['BOX CLAMP 45X86', 'CLAMP 45X86(BOX)']);
  });

  test('gauge is part of identity — same part, same rate, different gauge survives', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      { ...item(1, 'CLAMP TEST', '', 'NOS', 2.5), gauge: '30X6' },
      { ...item(2, 'CLAMP TEST', '', 'NOS', 2.5), gauge: '35X6' },
    ]));
    await switchTab(page, 'pageClients');

    const items = await itemsAfterLoad(page);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.gauge).sort()).toEqual(['30X6', '35X6']);
  });

  test('is idempotent — a second load removes nothing further', async ({ page }) => {
    await loadAppWithState(page, stateWithItems([
      item(1, 'NAIL', 'NAIL'),
      item(2, 'NAIL', 'NAIL'),
      item(3, 'CLAMP 133X83 (NT)', '35X6', 'NOS', 3.67),
      item(4, 'CLAMP 133X83 (NT)', '40X6', 'NOS', 4.24),
    ]));
    await switchTab(page, 'pageClients');
    const first = await itemsAfterLoad(page);

    await page.reload();
    await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
    const second = await itemsAfterLoad(page);

    expect(second).toHaveLength(first.length);
    expect(second).toHaveLength(3);
  });

});
