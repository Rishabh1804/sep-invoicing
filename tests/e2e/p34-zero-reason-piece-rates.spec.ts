import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, todayIso, type SepState } from './fixtures';

// P34: a line billed at ₹0 carries a reason; piece rates are the client's,
// dated and keyed on part + gauge; the scanner reads the client's own rates.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function zeroClientState(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  // No rate on record, so a new KG line prefills at ₹0.
  s.clients = [{ id: 7, name: 'ZERO TEST CLIENT', billingMode: 'weight', gstType: 'intra', gstin: '', rates: [], itemRates: [] } as any];
  return s;
}

async function openCreateWithLine(page: Page, state: SepState): Promise<void> {
  await loadAppWithState(page, state);
  await page.evaluate(() => { (window as any)._preselectedClientId = '7'; });
  await page.locator('[data-action="invCreateNew"]').first().click();
  await expect(page.locator('#pageCreate.inv-page-active')).toBeVisible();
  await page.locator('[data-action="invAddLineItem"]').click();
}

test.describe('P34: billed at ₹0 needs a reason', () => {
  test('a ₹0 line blocks save until a reason is picked; the note is optional', async ({ page }) => {
    await openCreateWithLine(page, zeroClientState());
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('48.8');

    const box = page.locator('#invZeroReason0 [data-zero-reason]');
    await expect(box).toBeVisible();
    await expect(page.locator('#invSaveBtn')).toBeDisabled();
    await expect(page.locator('#invErrorsArea')).toContainText('pick a reason');

    await box.locator('[data-reason="replating"]').click();
    await expect(box.locator('[data-reason="replating"]')).toHaveAttribute('aria-checked', 'true');
    // The note is recommended, never required: save is open without it.
    await expect(page.locator('#invSaveBtn')).toBeEnabled();

    await box.locator('[data-action="invZeroNote"]').fill('Returned lot, ch 812');
    await page.locator('#invSaveBtn').click();

    const st = await readStoredState(page);
    const line = st.invoices[0].items[0];
    expect(line.amount).toBe(0);
    expect(line.zeroReason).toBe('replating');
    expect(line.zeroNote).toBe('Returned lot, ch 812');
    expect(line.zeroReasonBackfilled).toBeUndefined();
  });

  test('pricing the line removes the reason block and saves no reason', async ({ page }) => {
    await openCreateWithLine(page, zeroClientState());
    await page.locator('input[data-field="qty"][data-idx="0"]').fill('10');
    await page.locator('#invZeroReason0 [data-reason="other"]').click();
    await page.locator('input[data-field="rate"][data-idx="0"]').fill('14.25');
    await expect(page.locator('#invZeroReason0 [data-zero-reason]')).toHaveCount(0);
    await page.locator('#invSaveBtn').click();
    const line = (await readStoredState(page)).invoices[0].items[0];
    expect(line.amount).toBe(142.5);
    expect(line.zeroReason).toBeUndefined();
  });

  test('history before the ruling is backfilled as replating; later lines are not', async ({ page }) => {
    const s = zeroClientState();
    const mk = (id: string, date: string) => ({
      id, invoiceNumber: id, displayNumber: 'SEP/TEST-' + id, date, status: 'active', invoiceState: 'filed',
      clientId: 7, clientName: 'ZERO TEST CLIENT', gstType: 'intra',
      items: [
        { partNumber: 'BASE PLATE', desc: 'BASE PLATE', unit: 'KG', qty: 16, rate: 0, amount: 0 },
        { partNumber: '90 CD', desc: '90 CD', unit: 'KG', qty: 10, rate: 14.25, amount: 142.5 },
      ],
      taxableValue: 142.5, createdAt: 1, updatedAt: 1,
    });
    // Dates are compared against the ruling's fixed date, not against today.
    s.invoices = [mk('00568', '2026-06-30'), mk('09999', '2099-01-01')];
    await loadAppWithState(page, s);
    const st = await readStoredState(page);
    const old = st.invoices.find((i: any) => i.id === '00568');
    const later = st.invoices.find((i: any) => i.id === '09999');
    expect(old.items[0].zeroReason).toBe('replating');
    expect(old.items[0].zeroReasonBackfilled).toBe('2026-09-24');
    expect(old.items[1].zeroReason).toBeUndefined();
    expect(later.items[0].zeroReason).toBeUndefined();
  });
});

function pieceState(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 2, name: 'PIECE CLIENT', billingMode: 'piece', gstType: 'intra', gstin: '',
      rates: [{ ratePerKg: 5.4, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
      pieceRates: [
        { partNumber: 'CLAMP 165X83 (NT)', gauge: '35X6', rate: 4.27, effectiveFrom: '2026-04-01' },
        { partNumber: 'CLAMP 165X83 (NT)', gauge: '40X6', rate: 4.89, effectiveFrom: '2026-04-01' },
        { partNumber: 'CLAMP 165X83 (NT)', gauge: '40X6', rate: 5.11, effectiveFrom: '2026-09-11' },
        { partNumber: '150X88X3', gauge: '', rate: 1.67, effectiveFrom: '2026-04-01' },
      ] },
    { id: 1, name: 'DORABJI AUTO', billingMode: 'weight', gstType: 'intra', gstin: '',
      rates: [{ ratePerKg: 13.75, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [] },
  ] as any;
  return s;
}

test.describe('P34: piece rates on record', () => {
  test('keyed on part and gauge, dated, case- and punctuation-blind', async ({ page }) => {
    await loadAppWithState(page, pieceState());
    const r = await g(page, `(function(){
      var c = S.clients.find(function(x){ return x.id === 2; });
      return {
        g35: getPieceRate(c, '2026-08-01', 'CLAMP 165X83 (NT)', '35X6'),
        g40: getPieceRate(c, '2026-08-01', 'clamp 165x83 (nt)', 'CLAMP (40X6)'),
        g40late: getPieceRate(c, '2026-09-20', 'CLAMP 165X83 (NT)', '40X6'),
        noGauge: getPieceRate(c, '2026-08-01', 'CLAMP 165X83 (NT)', 'CLAMP 165X83 (NT)'),
        pad: getPieceRate(c, '2026-08-01', '150x88x3', 'L.C.Pad 150x88x3'),
        before: getPieceRate(c, '2026-03-01', '150X88X3', 'L.C.Pad'),
        onRecordNos: getRateOnRecord(c, '2026-08-01', { partNumber: '150X88X3', desc: 'L.C.Pad', unit: 'NOS' }),
        onRecordKg: getRateOnRecord(c, '2026-08-01', { partNumber: 'X', desc: '', unit: 'KG' }),
        onRecordUnknown: getRateOnRecord(c, '2026-08-01', { partNumber: 'NEW PART', desc: '', unit: 'NOS' })
      };
    })()`);
    expect(r.g35.rate).toBe(4.27);
    expect(r.g40.rate).toBe(4.89);
    expect(r.g40late.rate).toBe(5.11);
    // Priced by gauge, line does not say which: reported, never guessed.
    expect(r.noGauge.ambiguous).toBe(true);
    // "150x88x3" is a part size, not a gauge.
    expect(r.pad.rate).toBe(1.67);
    expect(r.before).toBeNull();
    expect(r.onRecordNos).toMatchObject({ rate: 1.67, unit: 'piece', source: 'pieceRate' });
    expect(r.onRecordKg).toMatchObject({ rate: 5.4, unit: 'kg', source: 'ladder' });
    // A piece line with no card entry has no reference — never the ₹/kg figure.
    expect(r.onRecordUnknown).toBeNull();
  });

  test('fill from history leaves out a one-invoice swap and alternating rates', async ({ page }) => {
    const s = pieceState();
    (s.clients[0] as any).pieceRates = [];
    const inv = (n: string, date: string, items: any[]) => ({
      id: 'I' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed',
      clientId: 2, clientName: 'PIECE CLIENT', gstType: 'intra', items, taxableValue: 1, createdAt: 1, updatedAt: 1,
    });
    const L = (partNumber: string, desc: string, rate: number) => ({ partNumber, desc, unit: 'NOS', qty: 100, rate, amount: rate * 100 });
    s.invoices = [
      inv('858', '2026-08-31', [L('5174 5460 3302', 'BRACKET', 9), L('5166 5460 3303', 'BRACKET', 3)]),
      inv('860', '2026-08-31', [L('5174 5460 3302', 'BRACKET', 9)]),
      inv('861', '2026-08-31', [L('5166 5460 3303', 'BRACKET', 3)]),
      // The swap: each bracket at the other's rate, on one invoice each.
      inv('922', '2026-09-10', [L('5174 5460 3302', 'BRACKET', 3)]),
      inv('923', '2026-09-10', [L('5166 5460 3303', 'BRACKET', 9)]),
      // Two gauges under one name, no gauge on the line: 4.27 / 4.89 / 4.27.
      inv('780', '2026-08-04', [L('CLAMP 165X83 (NT)', 'CLAMP 165X83 (NT)', 4.27)]),
      inv('781', '2026-08-05', [L('CLAMP 165X83 (NT)', 'CLAMP 165X83 (NT)', 4.89)]),
      inv('782', '2026-08-06', [L('CLAMP 165X83 (NT)', 'CLAMP 165X83 (NT)', 4.27)]),
      inv('783', '2026-08-07', [L('CLAMP 165X83 (NT)', 'CLAMP 165X83 (NT)', 4.89)]),
      // A real rate change, established on two invoices each side.
      inv('700', '2026-06-01', [L('CLAMP 70X86 (NT)', '25X6', 2.05)]),
      inv('701', '2026-06-02', [L('CLAMP 70X86 (NT)', '25X6', 2.05)]),
      inv('702', '2026-07-01', [L('CLAMP 70X86 (NT)', '25X6', 2.08)]),
      inv('703', '2026-07-02', [L('CLAMP 70X86 (NT)', '25X6', 2.08)]),
    ];
    await loadAppWithState(page, s);
    const r = await g(page, `(function(){
      var c = S.clients.find(function(x){ return x.id === 2; });
      return pieceRatesFromHistory(c);
    })()`);
    const find = (pn: string) => r.add.filter((a: any) => a.partNumber === pn).map((a: any) => [a.gauge, a.rate, a.effectiveFrom]);
    expect(find('5174 5460 3302')).toEqual([['', 9, '2026-08-31']]);
    expect(find('5166 5460 3303')).toEqual([['', 3, '2026-08-31']]);
    expect(r.outliers.map((o: any) => [o.invoiceNumber, o.rate, o.usual]).sort()).toEqual([['922', 3, 9], ['923', 9, 3]]);
    expect(find('CLAMP 165X83 (NT)')).toEqual([]);
    expect(r.mixed.map((m: any) => m.partNumber)).toEqual(['CLAMP 165X83 (NT)']);
    expect(find('CLAMP 70X86 (NT)')).toEqual([['25X6', 2.05, '2026-06-01'], ['25X6', 2.08, '2026-07-01']]);
  });

  test('add and remove a piece rate through the client overlay', async ({ page }) => {
    await loadAppWithState(page, pieceState());
    await page.evaluate(() => (window as any).openClientEdit(2));
    await page.locator('#ceditPiecePart').fill('CLAMP 94X81 (NT)');
    await page.locator('#ceditPieceGauge').fill('25x6');
    await page.locator('#ceditPieceRate').fill('2.18');
    await page.locator('#ceditPieceDate').fill(todayIso());
    await page.locator('[data-action="invAddPieceRate"]').click();
    let st = await readStoredState(page);
    let pr = st.clients.find((c: any) => c.id === 2).pieceRates;
    expect(pr).toHaveLength(5);
    expect(pr[4]).toMatchObject({ partNumber: 'CLAMP 94X81 (NT)', gauge: '25X6', rate: 2.18, source: 'manual' });

    await expect(page.locator('#ceditPieceRates .inv-piece-row')).toHaveCount(5);
    await page.locator('[data-action="invRemovePieceRate"][data-idx="4"]').click();
    st = await readStoredState(page);
    pr = st.clients.find((c: any) => c.id === 2).pieceRates;
    expect(pr).toHaveLength(4);
  });
});

test.describe('P34: T-HC — the scanner reads the client\'s own rates', () => {
  test('a scanned KG line takes the client ladder, not the scanner\'s frozen figure', async ({ page }) => {
    await loadAppWithState(page, pieceState());
    const r = await g(page, `(function(){
      _applyScanResult({ clientName: 'DORABJI AUTO', challanNo: '41', challanDate: '2026-08-01',
        items: [{ partNumber: 'P1', desc: 'P1', unit: 'KG', qty: 10, rate: 13, amount: 130 }] });
      var line = _challanForm.items[0];
      return { rate: line.rate, amount: line.amount };
    })()`);
    // _scanClientMap says 13; the client's own ladder says 13.75.
    expect(r).toEqual({ rate: 13.75, amount: 137.5 });
  });

  test('a piece client keeps the challan\'s own amount; the card fills what it left out', async ({ page }) => {
    await loadAppWithState(page, pieceState());
    const r = await g(page, `(function(){
      _applyScanResult({ clientName: 'SSSMEHTA ENTERPRISES', challanNo: '42', challanDate: '2026-08-01',
        items: [
          { partNumber: '150X88X3', desc: 'L.C.Pad', unit: 'NOS', qty: 100, nosQty: 100, rate: 1.6, amount: 160 },
          { partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'NOS', qty: 100, nosQty: 100, rate: 0, amount: 0 }
        ] });
      return _challanForm.items.map(function(l){ return [l.rate, l.amount]; });
    })()`);
    expect(r).toEqual([[1.6, 160], [4.89, 489]]);
  });
});
