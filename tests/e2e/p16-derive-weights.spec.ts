import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, switchTab, todayIso, recentTs, SepState } from './fixtures';

/* loadAppWithState seeds through addInitScript, which re-runs on every
   navigation — so it restores the fixture on reload and would erase anything a
   test changed in between. These specs need a mutation to survive a reload, so
   they seed once behind a guard key instead. */
async function loadOnce(page: Page, state: SepState): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem(key as string, value as string);
        localStorage.setItem('__seeded', '1');
      }
    },
    ['sep_invoicing_state', JSON.stringify(state)] as const,
  );
  await page.goto('/');
  await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
}

/*
 * Bootstrap weight derivation.
 *
 * Where a client bills per piece off a rate per kg, the piece rate WAS the
 * weight times that rate, so weight = pieceRate / ratePerKg recovers it. On the
 * live backup this moved tonnage coverage from 61% to 94% of revenue and
 * blended realisation from an unmeasurable ₹13.00 (well-priced work only) to
 * ₹8.74 — against a costing model that independently says ₹8.45.
 */

function pieceState(): SepState {
  const state = emptyState();
  state.clients = [{
    id: 1, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', isActive: true,
    rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
  }] as unknown as SepState['clients'];
  state.items = [
    { id: 1, partNumber: 'CLAMP A', desc: 'CLAMP A', gauge: '', hsn: '998873', unit: 'NOS', rate: 2.7, stdWeightKg: null },
    { id: 2, partNumber: 'CLAMP B', desc: 'CLAMP B', gauge: '', hsn: '998873', unit: 'NOS', rate: 5.4, stdWeightKg: 0.9 },
  ];
  state.invoices = [{
    id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001',
    date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'PIECE CLIENT', gstType: 'intra',
    items: [
      // 2.70 / 5.40 = 0.5 kg
      { partNumber: 'CLAMP A', desc: 'CLAMP A', hsn: '998873', unit: 'NOS', qty: 100, rate: 2.7, amount: 270, nosQty: 100 },
      // Already weighed at 0.9 — must not be recomputed to 1.0.
      { partNumber: 'CLAMP B', desc: 'CLAMP B', hsn: '998873', unit: 'NOS', qty: 10, rate: 5.4, amount: 54, nosQty: 10 },
    ],
    taxableValue: 324, cgstAmt: 29.16, sgstAmt: 29.16, igstAmt: 0, grandTotal: 382.32,
    createdAt: recentTs(),
  }];
  return state;
}

const readItems = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!).items);

test('derives a missing weight from the client piece rate on load', async ({ page }) => {
  await loadAppWithState(page, pieceState());
  const items = await readItems(page);
  expect(items.find((i: { partNumber: string }) => i.partNumber === 'CLAMP A').stdWeightKg).toBeCloseTo(0.5, 4);
});

test('never overwrites a weight already on file', async ({ page }) => {
  await loadAppWithState(page, pieceState());
  const items = await readItems(page);
  // 5.40 / 5.40 would derive 1.0; the stored 0.9 must survive.
  expect(items.find((i: { partNumber: string }) => i.partNumber === 'CLAMP B').stdWeightKg).toBe(0.9);
});

test('is idempotent across reloads and does not re-derive a cleared weight', async ({ page }) => {
  await loadOnce(page, pieceState());
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sep_invoicing_state')!);
    s.items.find((i: { partNumber: string }) => i.partNumber === 'CLAMP A').stdWeightKg = null;
    localStorage.setItem('sep_invoicing_state', JSON.stringify(s));
  });
  await reload(page);

  // The pass already ran, so a deliberately cleared weight stays cleared —
  // the migration must not fight an operator's edit on every load.
  const items = await readItems(page);
  expect(items.find((i: { partNumber: string }) => i.partNumber === 'CLAMP A').stdWeightKg).toBeNull();
});

test('a device that loads empty still derives after data arrives', async ({ page }) => {
  // No invoices: there is nothing to derive from, so the pass must not be
  // marked done or an imported backup would never get one.
  const bare = emptyState();
  bare.items = [{ id: 1, partNumber: 'CLAMP A', desc: 'CLAMP A', gauge: '', hsn: '998873', unit: 'NOS', rate: 2.7, stdWeightKg: null }];
  await loadOnce(page, bare);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!)._deriveWeights1)).toBeFalsy();

  // Stands in for an import or a GitHub pull landing real data later.
  await page.evaluate((s) => localStorage.setItem('sep_invoicing_state', s as string), JSON.stringify(pieceState()));
  await reload(page);

  const items = await readItems(page);
  expect(items.find((i: { partNumber: string }) => i.partNumber === 'CLAMP A').stdWeightKg).toBeCloseTo(0.5, 4);
});

test('derived weights make the client measurable in Stats without changing billing', async ({ page }) => {
  const state = pieceState();
  state.defaultCostPerKg = 8.55;
  await loadAppWithState(page, state);
  await switchTab(page, 'pageStats');

  const table = page.locator('.inv-stats-card', { hasText: 'Realisation by Client' });
  const row = table.locator('.inv-stats-table-row').first();
  // 324 revenue over (100 x 0.5) + (10 x 0.9) = 59 kg = 5.49/kg, below cost.
  await expect(row).toContainText('PIECE CLIENT');
  await expect(row).toContainText('5.49');
  await expect(row.locator('.inv-stats-val-danger')).toHaveCount(1);
  await expect(table.locator('.inv-stats-row-partial')).toHaveCount(0);

  // The invoice's own money is untouched — stdWeightKg feeds Stats, never rates.
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!).invoices[0]);
  expect(inv.taxableValue).toBe(324);
  expect(inv.items[0].rate).toBe(2.7);
});

/*
 * Part identity: gauge, and lines with no catalogue row at all.
 *
 * Four clamp families exist in two gauges at different rates — CLAMP 165X83
 * (NT) at 35X6 and 40X6, and three more. The gauge is what tells those rows
 * apart, so a line reading just "Clamp 165x83" does not say which was plated.
 */

test('a piece-billed line with no catalogue row is still weighed', async ({ page }) => {
  const state = pieceState();
  // The part is on the invoice but absent from Items Master — the shape of 127
  // of SSSMehta's lines, 17% of that client's revenue. Routing weight through
  // the registry left every one of them uncounted; the line's own amount
  // divided by the client's rate per kg is all that is needed.
  (state.invoices as Array<Record<string, unknown>>)[0] = {
    ...(state.invoices as Array<Record<string, unknown>>)[0],
    items: [{ partNumber: 'CLAMP NOT IN MASTER', desc: 'CLAMP NOT IN MASTER', hsn: '998873', unit: 'NOS', qty: 200, rate: 2.7, amount: 540, nosQty: 200 }],
    taxableValue: 540,
  };
  state.items = [];
  await loadAppWithState(page, state);
  await switchTab(page, 'pageStats');

  // 540 / 5.40 = 100 kg, and realisation is the contract rate.
  const band = page.locator('.inv-kpi-grid').first();
  await expect(band).toContainText('0.10 t');
  await expect(band).toContainText('5.40');
  // Fully covered, so no shortfall caveat.
  await expect(page.locator('.inv-stats-caveat').filter({ hasText: 'no weight on file' })).toHaveCount(0);
});

test('the same part in two gauges is left for manual entry, never averaged', async ({ page }) => {
  const state = pieceState();
  // One part number, two catalogue rows, different gauges and rates — so two
  // different weights. An invoice line carries no gauge field, so a derived
  // figure cannot be attributed to either row.
  state.items = [
    { id: 1, partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', gauge: '35X6', hsn: '998873', unit: 'NOS', rate: 4.27, stdWeightKg: null },
    { id: 2, partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', gauge: '40X6', hsn: '998873', unit: 'NOS', rate: 4.89, stdWeightKg: null },
  ];
  (state.invoices as Array<Record<string, unknown>>)[0] = {
    ...(state.invoices as Array<Record<string, unknown>>)[0],
    items: [{ partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', hsn: '998873', unit: 'NOS', qty: 100, rate: 4.89, amount: 489, nosQty: 100 }],
    taxableValue: 489,
  };
  await loadAppWithState(page, state);

  const items = await readItems(page);
  expect(items.every((i: { stdWeightKg: number | null }) => i.stdWeightKg === null)).toBe(true);

  // Withholding the catalogue figure costs no tonnage: the line is still
  // weighed from its own amount. 489 / 5.40 = 90.56 kg.
  await switchTab(page, 'pageStats');
  await expect(page.locator('.inv-kpi-grid').first()).toContainText('0.09 t');
});

test('picking a part on a challan keeps the gauge in the line description', async ({ page }) => {
  const state = pieceState();
  state.clients = state.clients.map((c) => ({ ...c, isActive: true })) as SepState['clients'];
  state.items = [
    { id: 1, partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP', gauge: '40X6', hsn: '998873', unit: 'NOS', rate: 4.89, stdWeightKg: null },
  ];
  await loadAppWithState(page, state);
  await switchTab(page, 'pageIM');
  await page.locator('[data-action="invShowAddChallan"]').first().click();
  await page.locator('#imChallanClientSearch').fill('PIECE');
  await page.keyboard.press('Enter');

  await page.locator('#imPart0').fill('165X83');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // The challan path used to assign part.desc raw. IM is the billing spine, so
  // dropping the gauge here carried the ambiguity into every invoice raised
  // off the challan.
  await expect(page.locator('#imPart0')).toHaveValue('CLAMP (40X6)');
});
