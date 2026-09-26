import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P37: for a client billed by the kilo whose challans also count pieces, the
// kilograms are checked against pieces × the client's own weight per piece.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function inv(n: string, date: string, items: any[]) {
  return {
    id: 'I' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed',
    clientId: 1, clientName: 'DORABJI AUTO', gstType: 'intra',
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
  s.clients = [{ id: 1, name: 'DORABJI AUTO', billingMode: 'weight', gstType: 'intra', gstin: '',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
    pieceWeights: [{ partNumber: '2525 2015 8202', gauge: '', kgPerPiece: 0.212, effectiveFrom: '2026-04-01' }] }] as any;
  return s;
}

test.describe('P37: weight per piece — the kilograms checked', () => {
  test('classifies a weighed line against pieces × kg/pc', async ({ page }) => {
    await loadAppWithState(page, state());
    const r = await g(page, `(function(){
      var c = S.clients[0], d = '2026-08-01';
      var st = function(pcs, kg){ var m = weightMatch(c, d, { partNumber: '2525 2015 8202', unit: 'KG', qty: kg, nosQty: pcs, rate: 13 }); return m ? m.status : null; };
      return {
        exact: st(500, 106), withinTol: st(500, 108.5),   // +2.4%: a scale is not exact
        differs: st(500, 110),                            // +3.8%, ₹52 at stake
        checkPct: st(50, 12),                             // +13%, ₹11.80
        checkStake: st(2000, 440),                        // +3.8%, ₹208
        x10: st(500, 10.4),                               // 00086
        noPcs: st(0, 106), noCard: weightMatch(c, d, { partNumber: 'OTHER', unit: 'KG', qty: 5, nosQty: 10, rate: 13 }).status,
        nosLine: weightMatch(c, d, { partNumber: '2525 2015 8202', unit: 'NOS', qty: 500, nosQty: 500, rate: 3 })
      };
    })()`);
    expect(r).toEqual({ exact: 'match', withinTol: 'match', differs: 'differs', checkPct: 'check',
      checkStake: 'check', x10: 'decimal', noPcs: null, noCard: 'none', nosLine: null });
  });

  test('fill from history takes the median, needs two invoices, and lists two sizes under one name', async ({ page }) => {
    const s = state();
    (s.clients[0] as any).pieceWeights = [];
    s.invoices = [
      inv('001', '2026-05-01', [L('2525 2015 8202', 500, 106), L('WASHER', 1000, 21)]),
      inv('002', '2026-05-08', [L('2525 2015 8202', 400, 84.4), L('WASHER', 1000, 42)]),
      inv('003', '2026-05-15', [L('2525 2015 8202', 500, 10.4), L('WASHER', 1000, 21.2), L('ONCE ONLY', 10, 3)]),  // a ×10 slip
      inv('004', '2026-05-22', [L('2525 2015 8202', 300, 63.9), L('WASHER', 1000, 41.8)]),
    ];
    await loadAppWithState(page, s);
    const r = await g(page, 'pieceWeightsFromHistory(S.clients[0])');
    // Median of 0.212 / 0.211 / 0.0208 / 0.213 — the slip cannot drag it.
    expect(r.add).toEqual([{ partNumber: '2525 2015 8202', gauge: '', kgPerPiece: 0.2115, effectiveFrom: '2026-05-01', source: 'history' }]);
    expect(r.mixed.map((m: any) => m.partNumber)).toEqual(['WASHER']);
    expect(r.single).toBe(1);
  });

  test('the challan form checks the weight as pieces and kilograms are typed', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await g(page, `_applyScanResult({ clientName: 'DORABJI AUTO', challanNo: '86', challanDate: '${todayIso()}',
      items: [{ partNumber: '2525 2015 8202', desc: '2525 2015 8202', unit: 'KG', qty: 106, nosQty: 500, rate: 13, amount: 1378 }] })`);
    const note = page.locator('#imWeightMatch0 .inv-verdict .inv-dot');
    await expect(note).toHaveText('Weight matches');
    await page.locator('#imQty0').fill('10.4');
    await expect(note).toHaveText('Weight ×10');
    await page.locator('#imQty0').fill('106');
    await page.locator('#imNos0').fill('560');
    await expect(note).toHaveText('Check weight');
  });

  test('the invoice detail tags a weight that needs a second look, and the card saves', async ({ page }) => {
    const s = state();
    s.invoices = [inv('086', todayIso(), [L('2525 2015 8202', 500, 10.4), L('2525 2015 8202', 500, 106)])];
    await loadAppWithState(page, s);
    await page.evaluate(() => (window as any).openInvoiceDetail('I086'));
    const rows = page.locator('[data-lines]').first().locator('[data-line]');
    await expect(rows.nth(0).locator('.inv-verdict .inv-dot')).toHaveText('Weight ×10');
    await expect(rows.nth(1).locator('.inv-verdict .inv-dot')).toHaveCount(0);

    await page.evaluate(() => (window as any).closeOverlay && (window as any).closeOverlay());
    await page.evaluate(() => (window as any).openClientEdit(1));
    await page.locator('#ceditWtPart').fill('5079 4920 4205');
    await page.locator('#ceditWtKg').fill('0.448');
    await page.locator('[data-action="invAddPieceWeight"]').click();
    const st = await readStoredState(page);
    expect(st.clients[0].pieceWeights[1]).toMatchObject({ partNumber: '5079 4920 4205', kgPerPiece: 0.448, source: 'manual' });
  });
});
