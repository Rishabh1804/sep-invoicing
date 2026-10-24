import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, recentTs, todayIso, type SepState } from './fixtures';

// P38: a correction made on the invoice reaches the challan line it came from
// (owner, 24 Sep 2026: a piece count keyed at a tenth of itself was put right on the invoice, and the challan kept
// it). The client, its part and every figure here are made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function state(imItems: any[], invItems: any[]): SepState {
  const s = emptyState();
  s.clients = [{ id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '',
    rates: [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }], itemRates: [],
    pieceWeights: [{ partNumber: 'CLAMP 9105 0000 4705', gauge: '', kgPerPiece: 0.375, effectiveFrom: '2026-04-01' }] }] as any;
  s.incomingMaterial = [{ id: 'IM-4115', challanNo: '4115', challanDate: todayIso(), clientId: 1, clientName: 'DELTA AUTO',
    createdAt: recentTs(), items: imItems }];
  s.invoices = [{
    id: 'INV-830', invoiceNumber: '00830', displayNumber: 'SEP/TEST-00830', date: todayIso(), status: 'active',
    invoiceState: 'dispatched', clientId: 1, clientName: 'DELTA AUTO', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: invItems, taxableValue: 1964.63, cgstPer: 9, cgstAmt: 176.82, sgstPer: 9, sgstAmt: 176.82, igstPer: 0, igstAmt: 0,
    grandTotal: 2318.27, amountInWords: '', challanNo: '4115', linkedIMIds: ['IM-4115'], createdAt: recentTs(), updatedAt: recentTs(),
  }];
  return s;
}
const line = { partNumber: 'CLAMP 9105 0000 4705', desc: 'CLAMP', hsn: '998873', unit: 'KG', qty: 151.125, nosQty: 40, rate: 13, amount: 1964.63 };

test.describe('P38: an invoice correction reaches its challan', () => {
  test('pieces corrected on an older invoice are written back, with what they were', async ({ page }) => {
    await loadAppWithState(page, state([{ id: 'IM-4115-0', ...line, invoiced: true, invoiceId: 'INV-830' }], [{ ...line }]));
    await g(page, "editInvoice('INV-830')");
    const pcs = page.locator('input[data-field="nosQty"][data-idx="0"]');
    await expect(pcs).toHaveValue('40');
    await expect(page.locator('#invWeightMatch0 .inv-verdict .inv-dot')).toHaveText('Weight ×10');
    await pcs.fill('400');
    await expect(page.locator('#invWeightMatch0 .inv-verdict .inv-dot')).toHaveText('Weight matches');
    await page.locator('#invSaveBtn').click();
    // Shown after the tab switch, so it stays on screen (switchTab clears toasts).
    await expect(page.locator('.inv-toast')).toContainText('challan 4115 corrected to match (1 line)');

    const st = await readStoredState(page);
    const it = st.incomingMaterial[0].items[0];
    expect(it.nosQty).toBe(400);
    expect(it.qty).toBe(151.125);
    expect(it.corrections).toHaveLength(1);
    expect(it.corrections[0]).toMatchObject({ invoiceId: 'INV-830', invoice: 'SEP/TEST-00830', from: { nosQty: 40 }, to: { nosQty: 400 } });
    // The invoice line now names its challan line, so the next edit needs no guess.
    expect(st.invoices[0].items[0].imItemId).toBe('IM-4115-0');

    const hist = await g(page, "JSON.stringify(buildHistoryEvents().filter(function(e){ return e.type === 'audit'; }).map(function(e){ return e.text; }))");
    expect(JSON.parse(hist as string)).toContain('Challan 4115 corrected from SEP/TEST-00830: CLAMP 9105 0000 4705 — pieces 40 → 400');
  });

  test('an unchanged save writes nothing back, even where invoice and challan already differ', async ({ page }) => {
    // The challan's description and rate differ from the invoice for reasons
    // nobody decided in this edit; an untouched save must leave them alone.
    await loadAppWithState(page, state([{ id: 'IM-4115-0', ...line, desc: 'CLAMP 9105', rate: 13.5, invoiced: true, invoiceId: 'INV-830' }], [{ ...line }]));
    await g(page, "editInvoice('INV-830')");
    await page.locator('#invSaveBtn').click();
    const it = (await readStoredState(page)).incomingMaterial[0].items[0];
    expect(it.corrections).toBeUndefined();
    expect(it.desc).toBe('CLAMP 9105');
    expect(it.rate).toBe(13.5);
  });

  test('a line that matches two challan lines is left unlinked, never guessed', async ({ page }) => {
    await loadAppWithState(page, state([
      { id: 'IM-4115-0', ...line, invoiced: true, invoiceId: 'INV-830' },
      { id: 'IM-4115-1', ...line, invoiced: true, invoiceId: 'INV-830' },
    ], [{ ...line }]));
    await g(page, "editInvoice('INV-830')");
    await page.locator('input[data-field="nosQty"][data-idx="0"]').fill('400');
    await page.locator('#invSaveBtn').click();
    const st = await readStoredState(page);
    expect(st.incomingMaterial[0].items.map((i: any) => i.nosQty)).toEqual([40, 40]);
    expect(st.invoices[0].items[0].imItemId).toBeUndefined();
  });
});
