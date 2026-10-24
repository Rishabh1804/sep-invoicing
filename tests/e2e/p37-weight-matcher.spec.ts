import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P37: for a client billed by the kilo whose challans also count pieces, the
// kilograms are checked against pieces × the client's own weight per piece.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function inv(n: string, date: string, items: any[]) {
  return {
    id: 'I' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed',
    clientId: 1, clientName: 'DELTA AUTO', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items, taxableValue: 1, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: 1, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(),
  };
}
const L = (partNumber: string, pcs: number, kg: number, desc = '') =>
  ({ partNumber, desc: desc || partNumber, unit: 'KG', qty: kg, nosQty: pcs, rate: 13, amount: Math.round(kg * 1300) / 100 });

function state(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', isActive: true,
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
    pieceWeights: [{ partNumber: '9104 0000 8202', gauge: '', kgPerPiece: 0.185, effectiveFrom: '2026-04-01' }] }] as any;
  return s;
}

test.describe('P37: weight per piece — the kilograms checked', () => {
  test('classifies a weighed line against pieces × kg/pc', async ({ page }) => {
    await loadAppWithState(page, state());
    const r = await g(page, `(function(){
      var c = S.clients[0], d = '2026-08-01';
      var st = function(pcs, kg){ var m = weightMatch(c, d, { partNumber: '9104 0000 8202', unit: 'KG', qty: kg, nosQty: pcs, rate: 13 }); return m ? m.status : null; };
      return {
        exact: st(500, 92.5), withinTol: st(500, 94.7),   // +2.4%: a scale is not exact
        differs: st(500, 96),                             // +3.8%, ₹45.50 at stake
        checkPct: st(50, 10.5),                           // +13.5%, ₹16.25
        checkStake: st(2000, 384),                        // +3.8%, ₹182
        x10: st(500, 9.25),                               // a power of ten out
        noPcs: st(0, 92.5), noCard: weightMatch(c, d, { partNumber: 'OTHER', unit: 'KG', qty: 5, nosQty: 10, rate: 13 }).status,
        nosLine: weightMatch(c, d, { partNumber: '9104 0000 8202', unit: 'NOS', qty: 500, nosQty: 500, rate: 3 })
      };
    })()`);
    expect(r).toEqual({ exact: 'match', withinTol: 'match', differs: 'differs', checkPct: 'check',
      checkStake: 'check', x10: 'decimal', noPcs: null, noCard: 'none', nosLine: null });
  });

  test('fill from history takes the median, needs two invoices, and lists two sizes under one name', async ({ page }) => {
    const s = state();
    (s.clients[0] as any).pieceWeights = [];
    s.invoices = [
      inv('001', '2026-05-01', [L('9104 0000 8202', 500, 92.5), L('WASHER', 1000, 21)]),
      inv('002', '2026-05-08', [L('9104 0000 8202', 400, 73.6), L('WASHER', 1000, 42)]),
      inv('003', '2026-05-15', [L('9104 0000 8202', 500, 9.25), L('WASHER', 1000, 21.2), L('ONCE ONLY', 10, 3)]),  // a ×10 slip
      inv('004', '2026-05-22', [L('9104 0000 8202', 300, 55.8), L('WASHER', 1000, 41.8)]),
    ];
    await loadAppWithState(page, s);
    const r = await g(page, 'pieceWeightsFromHistory(S.clients[0])');
    // Median of 0.185 / 0.184 / 0.0185 / 0.186 — the slip cannot drag it.
    expect(r.add).toEqual([{ partNumber: '9104 0000 8202', gauge: '', kgPerPiece: 0.1845, effectiveFrom: '2026-05-01', source: 'history' }]);
    expect(r.mixed.map((m: any) => m.partNumber)).toEqual(['WASHER']);
    expect(r.single).toBe(1);
  });

  test('the challan form checks the weight as pieces and kilograms are typed', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    // Filled by hand (the challan scan came out, owner, 13 Oct 2026): the kilograms, then the pieces counted.
    await page.locator('[data-action="invShowAddChallan"]').first().click();
    await page.locator('#imChallanClientSearch').fill('DELTA');
    await page.locator('[data-action="invSelectChallanClient"]').first().click();
    await page.locator('[data-action="invEditChallanPart"][data-idx="0"]').fill('9104 0000 8202');
    await g(page, 'dismissAllAutocomplete()');
    await page.locator('#imQty0').fill('92.5');
    await page.locator('#imNos0').fill('500');
    const note = page.locator('#imWeightMatch0 .inv-verdict .inv-dot');
    await expect(note).toHaveText('Weight matches');
    await page.locator('#imQty0').fill('9.25');
    await expect(note).toHaveText('Weight ×10');
    await page.locator('#imQty0').fill('92.5');
    await page.locator('#imNos0').fill('560');
    await expect(note).toHaveText('Check weight');
  });

  test('the invoice detail tags a weight that needs a second look, and the card saves', async ({ page }) => {
    const s = state();
    s.invoices = [inv('091', todayIso(), [L('9104 0000 8202', 500, 9.25), L('9104 0000 8202', 500, 92.5)])];
    await loadAppWithState(page, s);
    await page.evaluate(() => (window as any).openInvoiceDetail('I091'));
    const rows = page.locator('[data-lines]').first().locator('[data-line]');
    await expect(rows.nth(0).locator('.inv-verdict .inv-dot')).toHaveText('Weight ×10');
    await expect(rows.nth(1).locator('.inv-verdict .inv-dot')).toHaveCount(0);

    await page.evaluate(() => (window as any).closeOverlay && (window as any).closeOverlay());
    await page.evaluate(() => (window as any).openClientEdit(1));
    await page.locator('#ceditWtPart').fill('9105 0000 4705');
    await page.locator('#ceditWtKg').fill('0.375');
    await page.locator('[data-action="invAddPieceWeight"]').click();
    const st = await readStoredState(page);
    expect(st.clients[0].pieceWeights[1]).toMatchObject({ partNumber: '9105 0000 4705', kgPerPiece: 0.375, source: 'manual' });
  });
});
