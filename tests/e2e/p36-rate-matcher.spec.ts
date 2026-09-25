import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P36: the rate matcher, option E as chosen by the owner 24 Sep 2026.
// match · ×10 slip · Check (≥ 10% off OR ≥ ₹100 at stake) · Differs · no rate · gauge.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function state(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.partWeights = { 'BRKT-W': 0.5 };
  s.clients = [
    { id: 1, name: 'DORABJI AUTO', billingMode: 'weight', gstType: 'intra', gstin: '',
      rates: [{ ratePerKg: 14.25, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [] },
    { id: 2, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', gstin: '',
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
      pieceRates: [
        { partNumber: 'CLAMP 49X86(BOX)', gauge: '25X6', rate: 1.57, effectiveFrom: '2026-04-01' },
        { partNumber: 'CLAMP 165X83 (NT)', gauge: '35X6', rate: 4.27, effectiveFrom: '2026-04-01' },
        { partNumber: 'CLAMP 165X83 (NT)', gauge: '40X6', rate: 4.89, effectiveFrom: '2026-04-01' },
      ] },
    { id: 3, name: 'N2W CLIENT', billingMode: 'nos_to_weight', gstType: 'intra', gstin: '',
      rates: [{ ratePerKg: 14.5, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [] },
  ] as any;
  return s;
}

test.describe('P36: rate matcher — option E', () => {
  test('classifies every case the rule names', async ({ page }) => {
    await loadAppWithState(page, state());
    const r = await g(page, `(function(){
      var C = function(id){ return S.clients.find(function(c){ return c.id === id; }); };
      var d = '2026-08-01';
      var st = function(c, it){ var m = rateMatch(C(c), d, it); return m ? m.status : null; };
      return {
        match:    st(1, { partNumber: 'P', unit: 'KG', qty: 100, rate: 14.25 }),
        decimal:  st(1, { partNumber: 'P', unit: 'KG', qty: 100, rate: 142.5 }),
        decLow:   st(2, { partNumber: 'CLAMP 49X86(BOX)', desc: '25X6', unit: 'NOS', qty: 10, rate: 0.157 }),
        differs:  st(1, { partNumber: 'P', unit: 'KG', qty: 100, rate: 15 }),       // 5.3%, ₹75
        checkPct: st(1, { partNumber: 'P', unit: 'KG', qty: 10, rate: 16 }),        // 12.3%, ₹17.50
        checkStk: st(2, { partNumber: 'CLAMP 49X86(BOX)', desc: '25X6', unit: 'NOS', qty: 920, rate: 1.44 }), // 8.3%, ₹119.60
        belowBoth:st(2, { partNumber: 'CLAMP 49X86(BOX)', desc: '25X6', unit: 'NOS', qty: 100, rate: 1.44 }), // 8.3%, ₹13
        gaugeOk:  st(2, { partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP (40X6)', unit: 'NOS', qty: 100, rate: 4.89 }),
        gauge:    st(2, { partNumber: 'CLAMP 165X83 (NT)', desc: 'CLAMP 165X83 (NT)', unit: 'NOS', qty: 100, rate: 4.89 }),
        none:     st(2, { partNumber: 'NEW PART', desc: '', unit: 'NOS', qty: 100, rate: 2 }),
        zero:     st(1, { partNumber: 'P', unit: 'KG', qty: 100, rate: 0, amount: 0 }),
        blank:    st(1, { partNumber: '', unit: 'KG', qty: 0, rate: 14.25 }),
        // nos_to_weight priced per kg: the stake is in kilograms, not pieces.
        n2wStake: rateMatch(C(3), d, { partNumber: 'BRKT-W', unit: 'NOS', qty: 400, rate: 15 }).stake
      };
    })()`);
    expect(r).toEqual({
      match: 'match', decimal: 'decimal', decLow: 'decimal', differs: 'differs', checkPct: 'check',
      checkStk: 'check', belowBoth: 'differs', gaugeOk: 'match', gauge: 'gauge', none: 'none',
      zero: null, blank: null, n2wStake: 100,
    });
  });

  test('the invoice form colours the rate as it is typed', async ({ page }) => {
    await loadAppWithState(page, state());
    await page.evaluate(() => { (window as any)._preselectedClientId = '1'; });
    await page.locator('[data-action="invCreateNew"]').first().click();
    await page.locator('[data-action="invAddLineItem"]').click();
    const qty = page.locator('input[data-field="qty"][data-idx="0"]');
    const rate = page.locator('input[data-field="rate"][data-idx="0"]');
    const note = page.locator('#invRateMatch0');

    await qty.fill('100');
    await expect(note.locator('.inv-rm-chip')).toHaveText('Matches');
    await expect(rate).toHaveClass(/inv-rm-input-match/);

    await rate.fill('15');
    await expect(note.locator('.inv-rm-chip')).toHaveText('Differs');
    await expect(note).toContainText('+₹75.00 on this line');

    await rate.fill('16');
    await expect(note.locator('.inv-rm-chip')).toHaveText('Check');
    await expect(rate).toHaveClass(/inv-rm-input-check/);
    await expect(rate).not.toHaveClass(/inv-rm-input-match/);

    await rate.fill('142.5');
    await expect(note.locator('.inv-rm-chip')).toHaveText('×10 slip');

    // Warn, never block: a line that needs checking still saves.
    await rate.fill('16');
    await expect(page.locator('#invSaveBtn')).toBeEnabled();
  });

  test('the challan form judges its lines too', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageIM');
    await g(page, `_applyScanResult({ clientName: 'DORABJI AUTO', challanNo: '41', challanDate: '${todayIso()}',
      items: [{ partNumber: 'P1', desc: 'P1', unit: 'KG', qty: 10, rate: 13, amount: 130 }] })`);
    await expect(page.locator('#imRateMatch0 .inv-rm-chip')).toHaveText('Matches');
    await page.locator('#imRate0').fill('20');
    await expect(page.locator('#imRateMatch0 .inv-rm-chip')).toHaveText('Check');
  });

  test('the invoice detail names only what needs a second look', async ({ page }) => {
    const s = state();
    s.invoices = [{
      id: 'INV-684', invoiceNumber: '00684', displayNumber: 'SEP/TEST-00684', date: todayIso(), status: 'active',
      invoiceState: 'created', clientId: 2, clientName: 'PIECE CLIENT', gstType: 'intra',
      clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [
        { partNumber: 'CLAMP 49X86(BOX)', desc: '25X6', unit: 'NOS', qty: 920, rate: 1.44, amount: 1324.8 },
        { partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'NOS', qty: 100, rate: 4.89, amount: 489 },
      ],
      taxableValue: 1813.8, cgstPer: 9, cgstAmt: 163.24, sgstPer: 9, sgstAmt: 163.24, igstPer: 0, igstAmt: 0,
      grandTotal: 2140.28, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(),
    }];
    await loadAppWithState(page, s);
    await page.evaluate(() => (window as any).openInvoiceDetail('INV-684'));
    const rows = page.locator('.inv-detail-items-table').first().locator('tbody tr');
    await expect(rows.nth(0).locator('.inv-rm-chip')).toHaveText('Check');
    await expect(rows.nth(0)).toContainText('−₹119.60 on this line');
    await expect(rows.nth(1).locator('.inv-rm-chip')).toHaveCount(0);
  });

  test('the thresholds are set in Settings and take effect at once', async ({ page }) => {
    await loadAppWithState(page, state());
    const judge = `rateMatch(S.clients[0], '2026-08-01', { partNumber: 'P', unit: 'KG', qty: 100, rate: 15 }).status`;
    // 5.3% off, ₹75 at stake: under the ruling's 10% / ₹100.
    expect(await g(page, judge)).toBe('differs');

    await page.evaluate(() => (window as any).openSettings('rateCheck'));
    await expect(page.locator('#setRcPct')).toHaveValue('10');
    await expect(page.locator('#setRcStake')).toHaveValue('100');
    await page.locator('#setRcPct').fill('5');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="rateCheck"]').click();

    expect(await g(page, judge)).toBe('check');
    const st = await readStoredState(page);
    expect(st.rateCheck).toEqual({ pct: 5, stake: 100, weightTol: 3 });
  });

  test('a backup written before the setting existed gets the ruling, and a zero never turns everything red', async ({ page }) => {
    const s: any = state();
    delete s.rateCheck;
    await loadAppWithState(page, s);
    expect(await g(page, 'JSON.stringify(S.rateCheck)')).toBe(JSON.stringify({ pct: 10, stake: 100, weightTol: 3 }));
    await g(page, 'S.rateCheck.pct = 0; S.rateCheck.stake = 0');
    expect(await g(page, `rateMatch(S.clients[0], '2026-08-01', { partNumber: 'P', unit: 'KG', qty: 100, rate: 15 }).status`)).toBe('differs');
  });
});
