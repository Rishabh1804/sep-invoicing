import { test, expect } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P35: the register finds an invoice by the challan it billed, and a line names
// its PART, not just its gauge. Owner report, 24 Sep 2026: searching a challan in
// the register showed part names and no part number.

function invoice(num: number, over: Record<string, unknown> = {}) {
  const n = String(num).padStart(5, '0');
  return {
    id: `INV-${num}`, invoiceNumber: n, displayNumber: `SEP/TEST-${n}`,
    date: todayIso(), status: 'active', invoiceState: 'created',
    clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra',
    clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', hsn: '998873', unit: 'NOS', qty: 100, rate: 4.89, amount: 489, nosQty: 100 }],
    taxableValue: 489, cgstPer: 9, cgstAmt: 44.01, sgstPer: 9, sgstAmt: 44.01, igstPer: 0, igstAmt: 0,
    grandTotal: 577.02, amountInWords: '', challanNo: '', challanDate: todayIso(),
    createdAt: recentTs(), updatedAt: recentTs(),
    ...over,
  };
}

function stateWith(invoices: unknown[]): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  s.invoices = invoices;
  s.invNextNum = 900;
  return s;
}


test.describe('P35: register search reaches the challan', () => {
  test('a challan number finds the invoice that billed it — whole numbers only', async ({ page }) => {
    await loadAppWithState(page, stateWith([
      invoice(835, { challanNo: '911, 912, 909' }),
      invoice(912, { challanNo: '700' }),   // invoice number contains 912; its challan does not
      invoice(836, { challanNo: '0913' }),
    ]));
    await switchTab(page, 'pageRegister');
    const search = page.locator('#regSearch');

    await search.fill('912');
    await expect(page.locator('#regList [data-invnum]').filter({ hasText: '00835' })).toHaveCount(1);
    // The invoice number still matches as before.
    await expect(page.locator('#regList [data-invnum]').filter({ hasText: '00912' })).toHaveCount(1);

    // Leading zeros on a challan do not hide it.
    await search.fill('913');
    await expect(page.locator('#regList [data-invnum]').filter({ hasText: '00836' })).toHaveCount(1);

    // A fragment of a challan number is not that challan.
    await search.fill('91');
    await expect(page.locator('#regList [data-invnum]').filter({ hasText: '00835' })).toHaveCount(0);
  });

  test('the invoice detail names the part, with the gauge beside it', async ({ page }) => {
    await loadAppWithState(page, stateWith([invoice(835, { challanNo: '911' })]));
    await page.evaluate(() => (window as any).openInvoiceDetail('INV-835'));
    await expect(page.locator('[data-lines]').first()).toContainText('CLAMP 165X83 (NT) · 40X6');
  });

  test('a challan line names the part, not only its gauge', async ({ page }) => {
    const s = stateWith([]);
    s.incomingMaterial = [{
      id: 'IM-1', challanNo: '911', challanDate: todayIso(), clientId: 1, clientName: 'TEST CLIENT KG',
      createdAt: recentTs(),
      items: [{ id: 'IT-1', partNumber: 'CLAMP 133X83 (NT)', desc: '35X6', hsn: '998873', unit: 'NOS', qty: 10, rate: 3.67, amount: 36.7, nosQty: 10 }],
    }];
    await loadAppWithState(page, s);
    await switchTab(page, 'pageIM');
    await page.locator('[data-action="invToggleIM"][data-id="IM-1"]').click();
    await expect(page.locator('[data-im-desc]').first()).toHaveText('CLAMP 133X83 (NT) · 35X6');
  });
});
